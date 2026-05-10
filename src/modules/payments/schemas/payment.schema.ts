import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled';
export type PaymentCycle = 'monthly' | 'yearly';
export type PaymentProvider = 'vnpay' | 'momo' | 'stripe';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['monthly', 'yearly'] })
  cycle: PaymentCycle;

  @Prop({ required: true, default: 'Pro' })
  plan: string;

  @Prop({ required: true, enum: ['vnpay', 'momo', 'stripe'], default: 'vnpay' })
  provider: PaymentProvider;

  @Prop({
    required: true,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: PaymentStatus;

  @Prop()
  transactionNo?: string;

  @Prop()
  responseCode?: string;

  @Prop()
  bankCode?: string;

  @Prop()
  payDate?: string;

  @Prop()
  ipAddr?: string;

  @Prop({ type: Object })
  raw?: Record<string, any>;

  @Prop()
  paidAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
