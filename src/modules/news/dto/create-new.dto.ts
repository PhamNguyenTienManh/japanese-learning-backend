import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  ValidateNested,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import { SyncItemDto } from "./sync-item.dto";

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

  @IsArray()
  @IsOptional()
  @ValidateNested({each: true})
  @Type(()=> SyncItemDto)
  syncData: SyncItemDto[];
}

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  link: string;

  @IsEnum(["easy", "medium", "hard"])
  @IsOptional()
  type?: string = "easy";

  @ValidateNested()
  @Type(() => CreateNewsContentDto)
  content: CreateNewsContentDto;

  @IsNumber()
  @IsOptional()
  level?: number = 1;

  @IsString()
  @IsOptional()
  grammarlist?: string = "";

  @IsBoolean()
  @IsOptional()
  published?: boolean = false;

  @IsOptional()
  dateField?: Date = new Date();
}
