// profiles/dto/create-profile.dto.ts
import { 
  IsNotEmpty, 
  IsOptional, 
  IsDateString, 
  IsEnum, 
  IsString, 
  Matches, 
  Validate, 
  MinLength
} from 'class-validator';
import { Types } from 'mongoose';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

function getAgeFromDate(value: any) {
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

// Custom validator: tuổi >= 3
export function MinAge(age: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minAge',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true; // allow empty (optional)
          const currentAge = getAgeFromDate(value);
          return currentAge !== null && currentAge >= age;
        },
        defaultMessage(args: ValidationArguments) {
          return `Birthday must be at least ${age} years old`;
        },
      },
    });
  };
}

export function MaxAge(age: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'maxAge',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true;
          const currentAge = getAgeFromDate(value);
          return currentAge !== null && currentAge <= age;
        },
        defaultMessage(args: ValidationArguments) {
          return `Birthday must not be older than ${age} years old`;
        },
      },
    });
  };
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  image_publicId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)\d{8}$/, { message: 'Phone number is invalid (VN format)' })
  phone?: string;

  @IsOptional()
  @IsDateString()
  @MinAge(3, { message: 'You must be at least 3 years old' })
  @MaxAge(150, { message: 'Birthday must not be older than 150 years old' })
  birthday?: Date;

  @IsOptional()
  @IsEnum([0, 1])
  sex?: number;

  @IsOptional()
  @IsString()
  job?: string;

  @IsOptional()
  @IsString()
  introduction?: string;
}
