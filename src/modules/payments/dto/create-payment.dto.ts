import { IsEnum } from 'class-validator';

export class CreateZalopayPaymentDto {
  @IsEnum(['monthly', 'yearly'], {
    message: 'cycle must be either "monthly" or "yearly"',
  })
  cycle: 'monthly' | 'yearly';
}

export class CreateStripePaymentDto {
  @IsEnum(['monthly', 'yearly'], {
    message: 'cycle must be either "monthly" or "yearly"',
  })
  cycle: 'monthly' | 'yearly';
}
