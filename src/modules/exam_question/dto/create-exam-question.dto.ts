import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class GeneralInfoDto {
  @IsOptional()
  @IsString()
  audio?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  txt_read?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AudioDto)
  audios?: AudioDto[];
}

class AudioDto {
  @IsOptional()
  @Min(0)
  audio_time?: number;
}

class QuestionContentDto {
  @IsNotEmpty()
  @IsString()
  question: string;

  @IsArray()
  @IsString({ each: true })
  answers: string[];

  @Min(0)
  @Max(3)
  correctAnswer: number;

  @IsOptional()
  @IsString()
  explain?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  explainAll?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number; // điểm cho câu hỏi
}

export class CreateExamQuestionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @Min(1)
  level: number;

  @Min(1)
  count_question: number;

  @ValidateNested()
  @Type(() => GeneralInfoDto)
  @IsOptional()
  general?: GeneralInfoDto;

  @ValidateNested({ each: true })
  @Type(() => QuestionContentDto)
  @IsOptional()
  content?: QuestionContentDto[];

  @IsOptional()
  @IsArray()
  @Min(0, { each: true })
  correct_answers?: number[];

  @IsOptional()
  score_difficult?: number;

  @IsOptional()
  @IsArray()
  scores?: number[];
}
