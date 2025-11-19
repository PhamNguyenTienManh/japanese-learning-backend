import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNewsContentDto {
  @IsOptional()
  @IsString()
  audio?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  @IsNotEmpty()
  textbody: string;

  @IsOptional()
  @IsString()
  video?: string;
}

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  link: string;

  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  type?: string = 'easy';

  @ValidateNested()
  @Type(() => CreateNewsContentDto)
  content: CreateNewsContentDto;

  @IsNumber()
  @IsOptional()
  level?: number = 1;

  @IsString()
  @IsOptional()
  grammarlist?: string = '';

  @IsBoolean()
  @IsOptional()
  publish?: boolean = false;

  @IsOptional()
  dateField?: Date = new Date();
}
