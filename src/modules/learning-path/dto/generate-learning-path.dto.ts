import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  Max,
  Min,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { GoalType, SkillType } from '../schemas/learning-path.schema';

const GOAL_TYPES: GoalType[] = ['jlpt_exam', 'conversation', 'vocabulary', 'writing'];
const SKILL_TYPES: SkillType[] = [
  'vocab',
  'grammar',
  'kanji',
  'reading',
  'writing',
  'conversation',
  'jlpt_exam',
];

export class GenerateLearningGoalDto {
  @IsIn(GOAL_TYPES)
  type: GoalType;

  @IsOptional()
  @IsArray()
  @IsIn(GOAL_TYPES, { each: true })
  types?: GoalType[];

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  targetScore?: number;

  @IsInt()
  @IsIn([15, 30, 45, 60])
  dailyMinutes: number;

  @IsOptional()
  @IsArray()
  @IsIn(SKILL_TYPES, { each: true })
  focusSkills?: SkillType[];
}

export class GenerateLearningPathDto {
  @IsIn(['N5', 'N4', 'N3', 'N2', 'N1'])
  level: string;

  @ValidateNested()
  @Type(() => GenerateLearningGoalDto)
  goal: GenerateLearningGoalDto;
}
