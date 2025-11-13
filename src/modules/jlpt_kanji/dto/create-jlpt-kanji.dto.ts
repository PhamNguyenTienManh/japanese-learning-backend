import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ----- Example DTO -----
export class ExampleDto {
  @IsNotEmpty()
  @IsString()
  w: string; // chữ ví dụ

  @IsNotEmpty()
  @IsString()
  m: string; // nghĩa

  @IsNotEmpty()
  @IsString()
  p: string; // phát âm
}

// ----- Create JLPT Kanji DTO -----
export class CreateJlptKanjiDto {
  @IsNotEmpty({ message: 'Kanji is required' })
  @IsString()
  kanji: string;

  @IsNotEmpty({ message: 'Mean is required' })
  @IsString()
  mean: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  @IsArray()
  examples?: ExampleDto[];

  @IsOptional()
  @IsString()
  kun?: string;

  @IsOptional()
  @IsString()
  on?: string;

  @IsOptional()
  @IsString()
  stroke_count?: string;

  @IsNotEmpty({ message: 'Level is required' })
  @IsEnum(['N5', 'N4', 'N3', 'N2', 'N1'], {
    message: 'Level must be one of N5, N4, N3, N2, N1',
  })
  level: string;

  // Map example_kun/on
  @IsOptional()
  example_kun?: Record<string, ExampleDto[]>;

  @IsOptional()
  example_on?: Record<string, ExampleDto[]>;
}
