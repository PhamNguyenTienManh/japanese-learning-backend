import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { MaxAge, MinAge } from '../../profiles/dto/update-profile.dto';

export class UpdateStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(['active', 'banned'], { 
    message: 'Status must be either "active" or "banned"' 
  })
  status: 'active' | 'banned';
}

export class UpdateRoleDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(['student', 'admin'], { 
    message: 'Role must be either "user" or "admin"' 
  })
  role: 'student' | 'admin';
}

export class AdminCreateUserDto {
  @IsEmail({}, { message: 'Email is invalid' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name: string;

  @IsOptional()
  @IsEnum(['student', 'admin'])
  role?: 'student' | 'admin';

  @IsOptional()
  @IsEnum(['active', 'banned'])
  status?: 'active' | 'banned';

  @IsOptional()
  @IsEnum([0, 1])
  sex?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)\d{8}$/, {
    message: 'Phone number is invalid (VN format)',
  })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Birthday must be a valid date' })
  @MinAge(3, { message: 'You must be at least 3 years old' })
  @MaxAge(150, { message: 'Birthday must not be older than 150 years old' })
  birthday?: Date;

  @IsOptional()
  @IsString()
  job?: string;

  @IsOptional()
  @IsString()
  introduction?: string;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email is invalid' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name?: string;

  @IsOptional()
  @IsEnum(['student', 'admin'])
  role?: 'student' | 'admin';

  @IsOptional()
  @IsEnum(['active', 'banned'])
  status?: 'active' | 'banned';

  @IsOptional()
  @IsEnum([0, 1])
  sex?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)\d{8}$/, {
    message: 'Phone number is invalid (VN format)',
  })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Birthday must be a valid date' })
  @MinAge(3, { message: 'You must be at least 3 years old' })
  @MaxAge(150, { message: 'Birthday must not be older than 150 years old' })
  birthday?: Date;

  @IsOptional()
  @IsString()
  job?: string;

  @IsOptional()
  @IsString()
  introduction?: string;
}
