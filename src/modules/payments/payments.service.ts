import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Payment, PaymentCycle } from './schemas/payment.schema';
import {
  buildVnpayPaymentUrl,
  verifyVnpaySignature,
} from './vnpay.helper';
import { buildMomoCreateBody, verifyMomoSignature } from './momo.helper';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import * as nodemailer from 'nodemailer';

// stripe v22 CJS types don't expose the inner `Stripe.Checkout.Session` /
// `Stripe.Event` namespace directly through the `StripeConstructor` default
// export, so we derive the shapes we actually use from the instance API.
type StripeInstance = InstanceType<typeof Stripe>;
type StripeSession = Awaited<
  ReturnType<StripeInstance['checkout']['sessions']['retrieve']>
>;
type StripeEvent = ReturnType<StripeInstance['webhooks']['constructEvent']>;

const PRICE_BY_CYCLE: Record<PaymentCycle, number> = {
  monthly: 249_000,
  yearly: 2_390_000,
};

export interface IpnResult {
  RspCode: string;
  Message: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripeClient?: StripeInstance;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly config: ConfigService,
  ) {}

  private getVnpayConfig() {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE');
    const hashSecret = this.config.get<string>('VNPAY_HASH_SECRET');
    const vnpUrl =
      this.config.get<string>('VNPAY_URL') ||
      'https://sandbox.vnpayment.vn/paymentv2/vnpayment.html';
    const returnUrl = this.config.get<string>('VNPAY_RETURN_URL');

    if (!tmnCode || !hashSecret || !returnUrl) {
      throw new Error(
        'VNPAY_TMN_CODE, VNPAY_HASH_SECRET and VNPAY_RETURN_URL must be set',
      );
    }
    return { tmnCode, hashSecret, vnpUrl, returnUrl };
  }

  private getMomoConfig() {
    const partnerCode = this.config.get<string>('MOMO_PARTNER_CODE');
    const accessKey = this.config.get<string>('MOMO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MOMO_SECRET_KEY');
    const endpoint =
      this.config.get<string>('MOMO_ENDPOINT') ||
      'https://test-payment.momo.vn/v2/gateway/api/create';
    const redirectUrl = this.config.get<string>('MOMO_RETURN_URL');
    const ipnUrl = this.config.get<string>('MOMO_IPN_URL');

    if (!partnerCode || !accessKey || !secretKey || !redirectUrl || !ipnUrl) {
      throw new Error(
        'MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_RETURN_URL and MOMO_IPN_URL must be set',
      );
    }
    return { partnerCode, accessKey, secretKey, endpoint, redirectUrl, ipnUrl };
  }

  private getStripeConfig() {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    const returnUrl = this.config.get<string>('STRIPE_RETURN_URL');
    const currency =
      this.config.get<string>('STRIPE_CURRENCY')?.toLowerCase() || 'vnd';

    if (!secretKey || !returnUrl) {
      throw new Error('STRIPE_SECRET_KEY and STRIPE_RETURN_URL must be set');
    }
    return { secretKey, webhookSecret, returnUrl, currency };
  }

  private getStripeClient(): StripeInstance {
    if (!this.stripeClient) {
      const { secretKey } = this.getStripeConfig();
      this.stripeClient = new Stripe(secretKey);
    }
    return this.stripeClient;
  }

  private genOrderId(): string {
    // yyyyMMddHHmmss + 4 random digits, fits well within VNPay's 100-char limit
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${stamp}${rand}`;
  }

  async createVnpayPayment(
    userId: string,
    cycle: PaymentCycle,
    ipAddr: string,
    bankCode?: string,
  ): Promise<{ paymentUrl: string; orderId: string; amount: number }> {
    const amount = PRICE_BY_CYCLE[cycle];
    if (!amount) {
      throw new BadRequestException('Invalid cycle');
    }

    const { tmnCode, hashSecret, vnpUrl, returnUrl } = this.getVnpayConfig();
    const orderId = this.genOrderId();

    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      orderId,
      amount,
      cycle,
      plan: 'Pro',
      provider: 'vnpay',
      status: 'pending',
      ipAddr,
    });

    const paymentUrl = buildVnpayPaymentUrl({
      tmnCode,
      hashSecret,
      vnpUrl,
      returnUrl,
      amount,
      orderId,
      orderInfo: `Thanh toan goi Pro ${cycle === 'yearly' ? 'nam' : 'thang'}: ${orderId}`,
      ipAddr,
      bankCode,
    });

    return { paymentUrl, orderId, amount };
  }

  /**
   * Process a VNPay return / IPN payload. Idempotent: re-running for an
   * already-success payment returns success without touching the user again.
   */
  async processVnpayCallback(
    query: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const { hashSecret } = this.getVnpayConfig();

    if (!verifyVnpaySignature(query, hashSecret)) {
      return { result: { RspCode: '97', Message: 'Invalid signature' } };
    }

    const orderId = String(query.vnp_TxnRef || '');
    const responseCode = String(query.vnp_ResponseCode || '');
    const transactionStatus = String(query.vnp_TransactionStatus || '');
    const amountFromVnp = Number(query.vnp_Amount || 0);

    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) {
      return { result: { RspCode: '01', Message: 'Order not found' } };
    }

    if (Math.round(payment.amount * 100) !== amountFromVnp) {
      return { result: { RspCode: '04', Message: 'Invalid amount' } };
    }

    if (payment.status === 'success') {
      return {
        result: { RspCode: '02', Message: 'Order already confirmed' },
        payment,
      };
    }

    payment.responseCode = responseCode;
    payment.transactionNo = query.vnp_TransactionNo
      ? String(query.vnp_TransactionNo)
      : undefined;
    payment.bankCode = query.vnp_BankCode
      ? String(query.vnp_BankCode)
      : undefined;
    payment.payDate = query.vnp_PayDate
      ? String(query.vnp_PayDate)
      : undefined;
    payment.raw = query;

    if (responseCode === '00' && transactionStatus === '00') {
      payment.status = 'success';
      payment.paidAt = new Date();
      await payment.save();
      await this.activatePremium(payment.userId.toString(), payment.cycle);
      await this.sendInvoiceFor(payment);
      return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
    }

    payment.status = 'failed';
    await payment.save();
    return {
      result: { RspCode: '00', Message: 'Confirm Success' },
      payment,
    };
  }

  async createMomoPayment(
    userId: string,
    cycle: PaymentCycle,
    ipAddr: string,
  ): Promise<{ paymentUrl: string; orderId: string; amount: number }> {
    const amount = PRICE_BY_CYCLE[cycle];
    if (!amount) {
      throw new BadRequestException('Invalid cycle');
    }

    const {
      partnerCode,
      accessKey,
      secretKey,
      endpoint,
      redirectUrl,
      ipnUrl,
    } = this.getMomoConfig();

    const orderId = this.genOrderId();
    const requestId = randomUUID();
    const orderInfo = `Thanh toan goi Pro ${cycle === 'yearly' ? 'nam' : 'thang'}: ${orderId}`;

    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      orderId,
      amount,
      cycle,
      plan: 'Pro',
      provider: 'momo',
      status: 'pending',
      ipAddr,
    });

    const body = buildMomoCreateBody({
      partnerCode,
      accessKey,
      secretKey,
      requestId,
      orderId,
      amount,
      orderInfo,
      redirectUrl,
      ipnUrl,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || data.resultCode !== 0 || !data.payUrl) {
      this.logger.error(
        `MoMo create failed: ${JSON.stringify(data)} (HTTP ${response.status})`,
      );
      await this.paymentModel.updateOne(
        { orderId },
        { status: 'failed', raw: data },
      );
      throw new BadRequestException(
        data.message || 'MoMo payment creation failed',
      );
    }

    return { paymentUrl: data.payUrl as string, orderId, amount };
  }

  /**
   * Process a MoMo redirect/IPN payload. Idempotent like the VNPay variant.
   * Returns a generic IpnResult; the controller maps it to the format each
   * channel expects (HTTP 204 for IPN, redirect for the browser return).
   */
  async processMomoCallback(
    body: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const { accessKey, secretKey } = this.getMomoConfig();

    if (!verifyMomoSignature(body, accessKey, secretKey)) {
      return { result: { RspCode: '97', Message: 'Invalid signature' } };
    }

    const orderId = String(body.orderId || '');
    const resultCode = Number(body.resultCode);
    const amountFromMomo = Number(body.amount || 0);

    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) {
      return { result: { RspCode: '01', Message: 'Order not found' } };
    }

    if (payment.amount !== amountFromMomo) {
      return { result: { RspCode: '04', Message: 'Invalid amount' } };
    }

    if (payment.status === 'success') {
      return {
        result: { RspCode: '02', Message: 'Order already confirmed' },
        payment,
      };
    }

    payment.responseCode = String(resultCode);
    payment.transactionNo = body.transId ? String(body.transId) : undefined;
    payment.bankCode = body.payType ? String(body.payType) : undefined;
    payment.payDate = body.responseTime ? String(body.responseTime) : undefined;
    payment.raw = body;

    if (resultCode === 0) {
      payment.status = 'success';
      payment.paidAt = new Date();
      await payment.save();
      await this.activatePremium(payment.userId.toString(), payment.cycle);
      await this.sendInvoiceFor(payment);
      return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
    }

    payment.status = 'failed';
    await payment.save();
    return {
      result: { RspCode: '00', Message: 'Confirm Success' },
      payment,
    };
  }

  async createStripePayment(
    userId: string,
    cycle: PaymentCycle,
    ipAddr: string,
  ): Promise<{ paymentUrl: string; orderId: string; amount: number }> {
    const amount = PRICE_BY_CYCLE[cycle];
    if (!amount) {
      throw new BadRequestException('Invalid cycle');
    }

    const { returnUrl, currency } = this.getStripeConfig();
    const stripe = this.getStripeClient();
    const orderId = this.genOrderId();

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      orderId,
      amount,
      cycle,
      plan: 'Pro',
      provider: 'stripe',
      status: 'pending',
      ipAddr,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: `JAVI Pro ${cycle === 'yearly' ? '(Hằng năm)' : '(Hằng tháng)'}`,
              description: `Đơn hàng ${orderId}`,
            },
          },
        },
      ],
      customer_email: user.email,
      client_reference_id: orderId,
      metadata: { orderId, userId, cycle },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?cancelled=1&orderId=${orderId}`,
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return { paymentUrl: session.url, orderId, amount };
  }

  /**
   * Browser-return handler. Stripe redirects the user back to our return URL
   * with `session_id` (success) or `cancelled=1&orderId=...` (cancel button).
   * We re-fetch the session to confirm payment_status — webhooks may not have
   * arrived yet, so this path also activates premium (idempotent).
   */
  async processStripeReturn(query: {
    session_id?: string;
    cancelled?: string;
    orderId?: string;
  }): Promise<{ result: IpnResult; payment?: Payment }> {
    if (query.cancelled && query.orderId) {
      const payment = await this.paymentModel.findOne({
        orderId: query.orderId,
      });
      if (payment && payment.status === 'pending') {
        payment.status = 'cancelled';
        await payment.save();
      }
      return {
        result: { RspCode: '24', Message: 'Customer cancelled' },
        payment: payment || undefined,
      };
    }

    if (!query.session_id) {
      return { result: { RspCode: '99', Message: 'Missing session_id' } };
    }

    const stripe = this.getStripeClient();
    let session: StripeSession;
    try {
      session = await stripe.checkout.sessions.retrieve(query.session_id);
    } catch (err: any) {
      this.logger.error(`Stripe session retrieve failed: ${err.message}`);
      return { result: { RspCode: '99', Message: 'Session lookup failed' } };
    }

    return this.applyStripeSession(session);
  }

  /**
   * Webhook handler. The controller is responsible for verifying the
   * signature and constructing the `Stripe.Event`; we just dispatch on type.
   */
  async processStripeWebhook(
    event: StripeEvent,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as StripeSession;
      return this.applyStripeSession(session);
    }
    return { result: { RspCode: '00', Message: 'Event ignored' } };
  }

  private async applyStripeSession(
    session: StripeSession,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const orderId =
      (session.metadata?.orderId as string | undefined) ||
      (session.client_reference_id as string | undefined) ||
      '';

    if (!orderId) {
      return { result: { RspCode: '01', Message: 'Order id missing' } };
    }

    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) {
      return { result: { RspCode: '01', Message: 'Order not found' } };
    }

    const expectedAmount = payment.amount;
    const amountFromStripe = Number(session.amount_total ?? 0);
    if (amountFromStripe && amountFromStripe !== expectedAmount) {
      return { result: { RspCode: '04', Message: 'Invalid amount' } };
    }

    if (payment.status === 'success') {
      return {
        result: { RspCode: '02', Message: 'Order already confirmed' },
        payment,
      };
    }

    payment.transactionNo =
      (session.payment_intent as string | undefined) || session.id;
    payment.responseCode = session.payment_status || '';
    payment.raw = session as unknown as Record<string, any>;

    if (session.payment_status === 'paid') {
      payment.status = 'success';
      payment.paidAt = new Date();
      await payment.save();
      await this.activatePremium(payment.userId.toString(), payment.cycle);
      await this.sendInvoiceFor(payment);
      return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
    }

    if (session.status === 'expired') {
      payment.status = 'failed';
      await payment.save();
    }

    return {
      result: { RspCode: '00', Message: 'Confirm Success' },
      payment,
    };
  }

  /**
   * Verify a Stripe webhook payload using the raw request body. Returns the
   * parsed Event so the controller can hand it to processStripeWebhook.
   */
  constructStripeEvent(rawBody: Buffer, signature: string): StripeEvent {
    const { webhookSecret } = this.getStripeConfig();
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not set');
    }
    const stripe = this.getStripeClient();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  /**
   * Build the HTML invoice and email it to the user. Idempotent — uses
   * `invoiceSentAt` on the payment doc to ensure we never send twice even
   * if the same callback gets replayed.
   */
  private async sendInvoiceFor(payment: Payment): Promise<void> {
    this.logger.log(`[invoice] start orderId=${payment.orderId}`);
    try {
      if (payment.invoiceSentAt) {
        this.logger.log(
          `[invoice] skip — already sent at ${payment.invoiceSentAt}`,
        );
        return;
      }

      if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        this.logger.warn(
          `[invoice] MAIL_USER / MAIL_PASS env not set — skipping email send`,
        );
        return;
      }

      const user = await this.userModel.findById(payment.userId).lean();
      if (!user?.email) {
        this.logger.warn(
          `[invoice] missing email for user ${payment.userId.toString()}`,
        );
        return;
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      const subject = `[JAVI] Hoá đơn điện tử #${payment.orderId}`;
      const html = this.renderInvoiceHtml(payment, user.email);

      const info = await transporter.sendMail({
        from: 'JAVI <noreply@javi.com>',
        to: user.email,
        subject,
        html,
      });

      this.logger.log(
        `[invoice] sent to ${user.email} messageId=${info.messageId}`,
      );

      await this.paymentModel.updateOne(
        { _id: payment._id },
        { invoiceSentAt: new Date() },
      );
    } catch (err: any) {
      this.logger.error(
        `[invoice] ${payment.orderId} failed: ${err?.message || err}`,
        err?.stack,
      );
    }
  }

  private renderInvoiceHtml(payment: Payment, email: string): string {
    const fmtVnd = (n: number) =>
      new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
    const cycleLabel =
      payment.cycle === 'yearly' ? 'Pro · Hằng năm' : 'Pro · Hằng tháng';
    const providerLabel =
      ({ vnpay: 'VNPay', momo: 'MoMo', stripe: 'Stripe' } as Record<
        string,
        string
      >)[payment.provider] || payment.provider;
    const paidAt = (payment.paidAt || new Date()).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    return `
<!doctype html>
<html lang="vi">
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#00879a 0%,#1f9bac 100%);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:1px;opacity:0.85;">JAVI</div>
              <div style="font-size:22px;font-weight:700;margin-top:6px;">Hoá đơn điện tử</div>
              <div style="font-size:13px;margin-top:4px;opacity:0.85;">Mã đơn: <b>#${payment.orderId}</b></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
                Xin chào <b>${email}</b>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
                Cảm ơn bạn đã nâng cấp gói <b>${cycleLabel}</b>. Đây là biên lai
                xác nhận giao dịch thành công. Hãy lưu lại để tiện đối chiếu khi
                cần.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:14px;">
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;width:42%;">Gói dịch vụ</td>
                  <td style="padding:12px 16px;color:#111827;font-weight:600;">${cycleLabel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;border-top:1px solid #e5e7eb;">Phương thức</td>
                  <td style="padding:12px 16px;color:#111827;border-top:1px solid #e5e7eb;">${providerLabel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;border-top:1px solid #e5e7eb;">Thời gian</td>
                  <td style="padding:12px 16px;color:#111827;border-top:1px solid #e5e7eb;">${paidAt}</td>
                </tr>
                ${
                  payment.transactionNo
                    ? `<tr>
                  <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;border-top:1px solid #e5e7eb;">Mã giao dịch</td>
                  <td style="padding:12px 16px;color:#111827;border-top:1px solid #e5e7eb;font-family:monospace;font-size:13px;">${payment.transactionNo}</td>
                </tr>`
                    : ''
                }
                ${
                  payment.bankCode
                    ? `<tr>
                  <td style="padding:12px 16px;background:#f9fafb;color:#6b7280;border-top:1px solid #e5e7eb;">Ngân hàng</td>
                  <td style="padding:12px 16px;color:#111827;border-top:1px solid #e5e7eb;">${payment.bankCode}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:14px 16px;background:#f0fdfa;color:#0f766e;font-weight:600;border-top:1px solid #ccfbf1;">Tổng thanh toán</td>
                  <td style="padding:14px 16px;color:#00879a;font-weight:700;font-size:18px;border-top:1px solid #ccfbf1;">${fmtVnd(payment.amount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 8px;font-size:13px;color:#4b5563;line-height:1.6;">
              Quyền lợi gói Pro của bạn đã được kích hoạt. Bạn có thể quay lại
              <a href="${process.env.FRONTEND_URL || '#'}" style="color:#00879a;text-decoration:none;font-weight:600;">trang chủ JAVI</a>
              để tiếp tục học.
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 28px;font-size:12px;color:#9ca3af;line-height:1.6;border-top:1px solid #f1f5f9;margin-top:12px;">
              Đây là email tự động. Nếu có thắc mắc, vui lòng phản hồi email này
              hoặc liên hệ bộ phận hỗ trợ.
              <br/>
              © ${new Date().getFullYear()} JAVI — Học tiếng Nhật cùng cộng đồng.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private async activatePremium(userId: string, cycle: PaymentCycle) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      this.logger.warn(`activatePremium: user ${userId} not found`);
      return;
    }

    const now = new Date();
    const isRenewal = !!(
      user.premium_expired_date && user.premium_expired_date > now
    );
    const base = isRenewal ? user.premium_expired_date! : now;

    const next = new Date(base);
    if (cycle === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }

    if (!isRenewal) {
      user.premium_date = now;
    }
    user.premium_expired_date = next;
    await user.save();
  }

  async findByOrderId(orderId: string): Promise<Payment> {
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async listForUser(userId: string): Promise<Payment[]> {
    return this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
