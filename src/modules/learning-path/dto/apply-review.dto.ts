import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SkillType } from '../schemas/learning-path.schema';

const SKILL_TYPES: SkillType[] = [
  'vocab',
  'grammar',
  'kanji',
  'reading',
  'writing',
  'conversation',
  'jlpt_exam',
];

class ApplyReviewItemDto {
  @IsIn(SKILL_TYPES)
  skill: SkillType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  targetCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(420)
  estimatedMinutes?: number;
}

export class ApplyReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyReviewItemDto)
  confirmedItems: ApplyReviewItemDto[];
}
