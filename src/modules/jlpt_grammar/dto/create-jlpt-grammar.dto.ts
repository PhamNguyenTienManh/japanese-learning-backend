import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

class ExampleDto {
  @IsNotEmpty({ message: "Content is required" })
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  transcription?: string;

  // optional theo schema gốc
  @IsOptional()
  @IsString()
  meaning?: string;
}

class UsageDto {
  // optional: nếu client gửi thì validate, nếu không gửi thì bỏ qua
  @IsOptional()
  @IsString()
  explain?: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  @ArrayMinSize(1, { message: "At least one example is required" })
  examples?: ExampleDto[];
}

export class CreateJlptGrammarDto {
  @IsNotEmpty({ message: "Level is required" })
  @IsEnum(["N5", "N4", "N3", "N2", "N1"], {
    message: "Level must be one of N5, N4, N3, N2, N1",
  })
  level: string;

  @IsNotEmpty({ message: "Title is required" })
  @IsString()
  title: string;

  @IsNotEmpty({ message: "Mean is required" })
  @IsString()
  mean: string;

  // <-- important: usages optional
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsageDto)
  usages?: UsageDto[];
}
