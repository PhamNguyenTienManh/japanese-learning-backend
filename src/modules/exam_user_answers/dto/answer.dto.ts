import { IsArray, IsMongoId, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SubAnswerDto {
  @IsNumber()
  @Min(0)
  subQuestionIndex: number; // thứ tự câu con

  @IsNumber()
  @Min(0)
  selectedAnswer: number; // index đáp án
}

export class AnswerDto {
  @IsMongoId()
  questionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubAnswerDto)
  subAnswers: SubAnswerDto[];
}

export class SaveAnswersDto {
  @IsMongoId()
  examResultId: string;

  @IsMongoId()
  partId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
