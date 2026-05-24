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
  buildZalopayAppTransId,
  buildZalopayCreateBody,
  buildZalopayQueryBody,
  extractOrderIdFromZalopayAppTransId,
  parseZalopayCallbackData,
  verifyZalopayCallback,
  verifyZalopayRedirect,
} from './zalopay.helper';
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

  private getZalopayConfig() {
    const appId = this.config.get<string>('ZALOPAY_APP_ID');
    const key1 = this.config.get<string>('ZALOPAY_KEY1');
    const key2 = this.config.get<string>('ZALOPAY_KEY2');
    const createEndpoint =
      this.config.get<string>('ZALOPAY_CREATE_ENDPOINT') ||
      'https://sb-openapi.zalopay.vn/v2/create';
    const queryEndpoint =
      this.config.get<string>('ZALOPAY_QUERY_ENDPOINT') ||
      'https://sb-openapi.zalopay.vn/v2/query';
    const callbackUrl = this.config.get<string>('ZALOPAY_CALLBACK_URL');
    const returnUrl = this.config.get<string>('ZALOPAY_RETURN_URL');
    const bankCode = this.config.get<string>('ZALOPAY_BANK_CODE') ?? 'zalopayapp';

    if (!appId || !key1 || !key2 || !callbackUrl || !returnUrl) {
      throw new Error(
        'ZALOPAY_APP_ID, ZALOPAY_KEY1, ZALOPAY_KEY2, ZALOPAY_CALLBACK_URL and ZALOPAY_RETURN_URL must be set',
      );
    }
    return {
      appId,
      key1,
      key2,
      createEndpoint,
      queryEndpoint,
      callbackUrl,
      returnUrl,
      bankCode,
    };
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
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${stamp}${rand}`;
  }

  async createZalopayPayment(
    userId: string,
    cycle: PaymentCycle,
    ipAddr: string,
  ): Promise<{ paymentUrl: string; orderId: string; amount: number }> {
    const amount = PRICE_BY_CYCLE[cycle];
    if (!amount) {
      throw new BadRequestException('Invalid cycle');
    }

    const {
      appId,
      key1,
      createEndpoint,
      callbackUrl,
      returnUrl,
      bankCode,
    } = this.getZalopayConfig();

    const orderId = this.genOrderId();
    const appTransId = buildZalopayAppTransId(orderId);
    const appTime = Date.now();
    const item = JSON.stringify([
      {
        itemid: `javi-pro-${cycle}`,
        itemname: `JAVI Pro ${cycle}`,
        itemprice: amount,
        itemquantity: 1,
      },
    ]);
    const embedData = JSON.stringify({
      redirecturl: returnUrl,
      preferred_payment_method: ['zalopay_wallet'],
      orderId,
      cycle,
    });

    await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      orderId,
      amount,
      cycle,
      plan: 'Pro',
      provider: 'zalopay',
      status: 'pending',
      ipAddr,
      raw: { appTransId },
    });

    const body = buildZalopayCreateBody({
      appId,
      key1,
      appTransId,
      appUser: userId,
      appTime,
      amount,
      item,
      embedData,
      description: `JAVI - Thanh toán gói Pro ${cycle === 'yearly' ? 'năm' : 'tháng'} #${orderId}`,
      bankCode,
      callbackUrl,
    });

    const form = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      form.set(key, String(value));
    });

    const response = await fetch(createEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || Number(data.return_code) !== 1 || !data.order_url) {
      this.logger.error(
        `ZaloPay create failed: ${JSON.stringify(data)} (HTTP ${response.status})`,
      );
      await this.paymentModel.updateOne(
        { orderId },
        { status: 'failed', raw: { appTransId, createResponse: data } },
      );
      throw new BadRequestException(
        data.return_message || 'ZaloPay payment creation failed',
      );
    }

    await this.paymentModel.updateOne(
      { orderId },
      { raw: { appTransId, createResponse: data } },
    );

    return { paymentUrl: String(data.order_url), orderId, amount };
  }

  async processZalopayCallback(
    body: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const { key2 } = this.getZalopayConfig();

    if (!verifyZalopayCallback(body, key2)) {
      return { result: { RspCode: '97', Message: 'Invalid signature' } };
    }

    let data: Record<string, any>;
    try {
      data = parseZalopayCallbackData(body);
    } catch {
      return { result: { RspCode: '99', Message: 'Invalid callback data' } };
    }

    const appTransId = String(data.app_trans_id || '');
    const orderId = extractOrderIdFromZalopayAppTransId(appTransId);
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) {
      return { result: { RspCode: '01', Message: 'Order not found' } };
    }

    return this.confirmZalopayPayment(payment, data, {
      ...(payment.raw || {}),
      callback: body,
      callbackData: data,
    });
  }

  async processZalopayReturn(
    query: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const { key2 } = this.getZalopayConfig();

    if (!verifyZalopayRedirect(query, key2)) {
      return { result: { RspCode: '97', Message: 'Invalid signature' } };
    }

    const appTransId = String(query.apptransid || '');
    const orderId = extractOrderIdFromZalopayAppTransId(appTransId);
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) {
      return { result: { RspCode: '01', Message: 'Order not found' } };
    }

    const amountFromZalopay = Number(query.amount || 0);
    if (amountFromZalopay && amountFromZalopay !== payment.amount) {
      return { result: { RspCode: '04', Message: 'Invalid amount' }, payment };
    }

    if (payment.status === 'success') {
      return {
        result: { RspCode: '02', Message: 'Order already confirmed' },
        payment,
      };
    }

    payment.responseCode = String(query.status ?? '');
    payment.bankCode = query.bankcode ? String(query.bankcode) : payment.bankCode;
    payment.raw = { ...(payment.raw || {}), redirect: query };

    if (Number(query.status) !== 1) {
      payment.status = 'failed';
      await payment.save();
      return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
    }

    try {
      const status = await this.queryZalopayOrderStatus(appTransId);
      return this.applyZalopayStatus(payment, status, query);
    } catch (err: any) {
      this.logger.error(
        `ZaloPay status lookup failed: ${err?.message || err}`,
        err?.stack,
      );
      await payment.save();
      return {
        result: { RspCode: '99', Message: 'ZaloPay status lookup failed' },
        payment,
      };
    }
  }

  private async queryZalopayOrderStatus(appTransId: string) {
    const { appId, key1, queryEndpoint } = this.getZalopayConfig();
    const body = buildZalopayQueryBody({ appId, key1, appTransId });
    const form = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      form.set(key, String(value));
    });

    const response = await fetch(queryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  private async applyZalopayStatus(
    payment: Payment,
    status: Record<string, any>,
    redirect: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    payment.responseCode = String(status.return_code ?? '');
    payment.transactionNo = status.zp_trans_id
      ? String(status.zp_trans_id)
      : payment.transactionNo;
    payment.raw = { ...(payment.raw || {}), redirect, status };

    if (Number(status.return_code) === 1) {
      return this.confirmZalopayPayment(payment, status, payment.raw);
    }

    if (Number(status.return_code) === 2) {
      payment.status = 'failed';
      await payment.save();
      return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
    }

    await payment.save();
    return {
      result: { RspCode: '03', Message: 'Payment is processing' },
      payment,
    };
  }

  private async confirmZalopayPayment(
    payment: Payment,
    data: Record<string, any>,
    raw: Record<string, any>,
  ): Promise<{ result: IpnResult; payment?: Payment }> {
    const amountFromZalopay = Number(data.amount || 0);
    if (amountFromZalopay && amountFromZalopay !== payment.amount) {
      return { result: { RspCode: '04', Message: 'Invalid amount' }, payment };
    }

    if (payment.status === 'success') {
      return {
        result: { RspCode: '02', Message: 'Order already confirmed' },
        payment,
      };
    }

    payment.responseCode = '1';
    payment.transactionNo = data.zp_trans_id
      ? String(data.zp_trans_id)
      : payment.transactionNo;
    payment.bankCode = data.channel ? String(data.channel) : payment.bankCode;
    payment.payDate = data.server_time ? String(data.server_time) : payment.payDate;
    payment.raw = raw;
    payment.status = 'success';
    payment.paidAt = new Date();
    await payment.save();
    await this.activatePremium(payment.userId.toString(), payment.cycle);
    await this.sendInvoiceFor(payment);
    return { result: { RspCode: '00', Message: 'Confirm Success' }, payment };
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
      ({ zalopay: 'ZaloPay', stripe: 'Stripe' } as Record<
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
