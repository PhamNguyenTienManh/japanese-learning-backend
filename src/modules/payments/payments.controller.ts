import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import {
  CreateStripePaymentDto,
  CreateZalopayPaymentDto,
} from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { getClientIp } from './zalopay.helper';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('zalopay/create')
  async createZalopay(
    @Body() dto: CreateZalopayPaymentDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const userId = req.user.sub;
    const ipAddr = getClientIp(req);
    return this.paymentsService.createZalopayPayment(userId, dto.cycle, ipAddr);
  }

  @Public()
  @Get('zalopay/return')
  async zalopayReturn(
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ) {
    const { result, payment } = await this.paymentsService.processZalopayReturn(
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
      provider: 'zalopay',
      status,
      orderId: payment?.orderId || String(query.apptransid || ''),
      code: String(query.status || result.RspCode || ''),
    });
    if (payment) {
      params.set('amount', String(payment.amount));
      params.set('cycle', payment.cycle);
    }

    return res.redirect(`${frontendUrl}/payment/success?${params.toString()}`);
  }

  @Public()
  @Post('zalopay/callback')
  async zalopayCallback(
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ) {
    const { result } = await this.paymentsService.processZalopayCallback(body);
    const returnCode =
      result.RspCode === '00'
        ? 1
        : result.RspCode === '02'
          ? 2
          : result.RspCode === '97'
            ? -1
            : 0;

    return res.status(200).json({
      return_code: returnCode,
      return_message: result.Message,
    });
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

  @Get('admin')
  @Roles('admin')
  async listAdminPayments(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status = 'all',
    @Query('q') q = '',
  ) {
    return this.paymentsService.listForAdmin({
      page: Number(page),
      limit: Number(limit),
      status,
      q,
    });
  }

  @Get('admin/:id')
  @Roles('admin')
  async getAdminPaymentDetail(@Param('id') id: string) {
    return this.paymentsService.findAdminPayment(id);
  }
}
