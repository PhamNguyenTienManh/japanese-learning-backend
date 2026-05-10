import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateVnpayPaymentDto {
  @IsEnum(['monthly', 'yearly'], {
    message: 'cycle must be either "monthly" or "yearly"',
  })
  cycle: 'monthly' | 'yearly';

  @IsOptional()
  @IsString()
  bankCode?: string;
}

export class CreateMomoPaymentDto {
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
