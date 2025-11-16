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
          const birthDate = new Date(value);
          const today = new Date();
          const ageDiff = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const dayDiff = today.getDate() - birthDate.getDate();
          return ageDiff > age || (ageDiff === age && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0)));
        },
        defaultMessage(args: ValidationArguments) {
          return `Birthday must be at least ${age} years old`;
        },
      },
    });
  };
}

export class CreateProfileDto {
  @IsNotEmpty()
  userId: Types.ObjectId;

  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

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
