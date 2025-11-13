import { IsEnum, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Types } from 'mongoose';

export class CreateExamPartDto {
  examId: Types.ObjectId;

  @IsNotEmpty()
  @IsEnum(['Từ vựng', 'Ngữ pháp - Đọc hiểu', 'Thi nghe'])
  name: string;

  @IsNumber()
  @Min(1)
  time: number;

  @IsNumber()
  @Min(0)
  min_score: number;

  @IsNumber()
  @Min(0)
  max_score: number;
}
