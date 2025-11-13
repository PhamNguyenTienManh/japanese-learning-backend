import { 
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';

class ExampleDto {
  @IsNotEmpty()
  @IsString()
  jp: string; // câu ví dụ tiếng Nhật

  @IsOptional()
  @IsString()
  vi?: string; // nghĩa tiếng Việt của câu ví dụ
}

class MeaningDto {
  @IsNotEmpty()
  @IsString()
  meaning: string; // nghĩa tiếng Việt hoặc tiếng Anh

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  @IsOptional()
  examples?: ExampleDto[]; // danh sách ví dụ
}

export class CreateJlptWordDto {
  @IsNotEmpty({ message: 'Word is required' })
  @IsString()
  word: string;

  @IsArray({ message: 'Phonetic must be an array' })
  @ArrayMinSize(1, { message: 'At least one phonetic is required' })
  @IsString({ each: true })
  phonetic: string[];

  @IsEnum(
    [
      'Danh từ',
      'Động từ',
      'Tính từ -i',
      'Tính từ -na',
      'Trạng từ',
      'Trợ từ',
      'Trợ động từ',
      'Định từ',
      'Liên từ',
      'Thán từ',
    ],
    { message: 'Invalid type' }
  )
  type: string;

  @ValidateNested({ each: true })
  @Type(() => MeaningDto)
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one meaning is required' })
  meanings: MeaningDto[];

  @IsNotEmpty({ message: 'Level is required' })
  @IsEnum(['N5', 'N4', 'N3', 'N2', 'N1'], {
    message: 'Level must be one of N5, N4, N3, N2, N1',
  })
  level: string;

  @IsOptional()
  @IsBoolean({ message: 'isJlpt must be a boolean value' })
  isJlpt?: boolean;
}
