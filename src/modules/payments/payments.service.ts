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
              name: `JLearn Pro ${cycle === 'yearly' ? '(Hằng năm)' : '(Hằng tháng)'}`,
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
