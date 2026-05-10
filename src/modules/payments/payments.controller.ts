import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import {
  CreateMomoPaymentDto,
  CreateStripePaymentDto,
  CreateVnpayPaymentDto,
} from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { getClientIp } from './vnpay.helper';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('vnpay/create')
  async createVnpay(
    @Body() dto: CreateVnpayPaymentDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const userId = req.user.sub;
    const ipAddr = getClientIp(req);
    return this.paymentsService.createVnpayPayment(
      userId,
      dto.cycle,
      ipAddr,
      dto.bankCode,
    );
  }

  /**
   * Browser redirect endpoint. We verify, activate premium if needed, then
   * redirect the user to the frontend success/failure page so the SPA can
   * read the result from query params.
   */
  @Public()
  @Get('vnpay/return')
  async vnpayReturn(@Query() query: Record<string, any>, @Res() res: Response) {
    const { result, payment } = await this.paymentsService.processVnpayCallback(
      query,
    );

    const frontendUrl = process.env.FRONTEND_URL || '';
    const status =
      result.RspCode === '00' && payment?.status === 'success'
        ? 'success'
        : result.RspCode === '02'
          ? 'success'
          : 'failed';

    const params = new URLSearchParams({
      provider: 'vnpay',
      status,
      orderId: String(query.vnp_TxnRef || ''),
      code: String(query.vnp_ResponseCode || ''),
    });
    if (payment) {
      params.set('amount', String(payment.amount));
      params.set('cycle', payment.cycle);
    }

    return res.redirect(`${frontendUrl}/payment/success?${params.toString()}`);
  }

  /**
   * Server-to-server IPN. Must respond with the exact JSON shape VNPay expects
   * (no wrapping by the global TransformInterceptor), so we use @Res directly.
   */
  @Public()
  @Get('vnpay/ipn')
  async vnpayIpn(@Query() query: Record<string, any>, @Res() res: Response) {
    const { result } = await this.paymentsService.processVnpayCallback(query);
    return res.status(200).json(result);
  }

  @Post('momo/create')
  async createMomo(
    @Body() dto: CreateMomoPaymentDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const userId = req.user.sub;
    const ipAddr = getClientIp(req);
    return this.paymentsService.createMomoPayment(userId, dto.cycle, ipAddr);
  }

  /**
   * Browser redirect endpoint. MoMo appends query params on the GET back
   * to our redirectUrl; we verify, activate premium if needed, and bounce
   * the user to the SPA success page.
   */
  @Public()
  @Get('momo/return')
  async momoReturn(@Query() query: Record<string, any>, @Res() res: Response) {
    const { result, payment } = await this.paymentsService.processMomoCallback(
      query,
    );

    const frontendUrl = process.env.FRONTEND_URL || '';
    const status =
      result.RspCode === '00' && payment?.status === 'success'
        ? 'success'
        : result.RspCode === '02'
          ? 'success'
          : 'failed';

    const params = new URLSearchParams({
      provider: 'momo',
      status,
      orderId: String(query.orderId || ''),
      code: String(query.resultCode || ''),
    });
    if (payment) {
      params.set('amount', String(payment.amount));
      params.set('cycle', payment.cycle);
    }

    return res.redirect(`${frontendUrl}/payment/success?${params.toString()}`);
  }

  /**
   * MoMo IPN — server-to-server JSON POST. Spec expects HTTP 204 No Content
   * when we have processed (or knowingly ignore) the notification.
   */
  @Public()
  @Post('momo/ipn')
  async momoIpn(@Body() body: Record<string, any>, @Res() res: Response) {
    await this.paymentsService.processMomoCallback(body);
    return res.status(204).send();
  }

  @Post('stripe/create')
  async createStripe(
    @Body() dto: CreateStripePaymentDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const userId = req.user.sub;
    const ipAddr = getClientIp(req);
    return this.paymentsService.createStripePayment(userId, dto.cycle, ipAddr);
  }

  /**
   * Browser-return endpoint. Stripe Checkout redirects the user here with
   * either `session_id={CHECKOUT_SESSION_ID}` (success path) or
   * `cancelled=1&orderId=...` (when the user clicks Back on Stripe).
   */
  @Public()
  @Get('stripe/return')
  async stripeReturn(@Query() query: Record<string, any>, @Res() res: Response) {
    const { result, payment } = await this.paymentsService.processStripeReturn(
      query,
    );

    const frontendUrl = process.env.FRONTEND_URL || '';
    const status =
      result.RspCode === '00' && payment?.status === 'success'
        ? 'success'
        : result.RspCode === '02'
          ? 'success'
          : 'failed';

    const params = new URLSearchParams({
      provider: 'stripe',
      status,
      orderId: payment?.orderId || String(query.orderId || ''),
      code: result.RspCode,
    });
    if (payment) {
      params.set('amount', String(payment.amount));
      params.set('cycle', payment.cycle);
    }

    return res.redirect(`${frontendUrl}/payment/success?${params.toString()}`);
  }

  /**
   * Stripe webhook. Body is mounted as raw Buffer in main.ts so the signature
   * check sees exactly the bytes Stripe signed.
   */
  @Public()
  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    try {
      const event = this.paymentsService.constructStripeEvent(
        req.body as Buffer,
        signature,
      );
      await this.paymentsService.processStripeWebhook(event);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  @Get('me')
  async listMyPayments(@Req() req: Request & { user: { sub: string } }) {
    return this.paymentsService.listForUser(req.user.sub);
  }
}
