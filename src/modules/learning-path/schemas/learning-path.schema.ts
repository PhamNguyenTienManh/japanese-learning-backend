import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GoalType = 'jlpt_exam' | 'conversation' | 'vocabulary' | 'writing';

export type SkillType =
  | 'vocab'
  | 'grammar'
  | 'kanji'
  | 'reading'
  | 'writing'
  | 'conversation'
  | 'jlpt_exam';

export const GOAL_SKILL_DEFAULTS: Record<GoalType, SkillType[]> = {
  jlpt_exam: ['vocab', 'grammar', 'kanji', 'reading', 'jlpt_exam'],
  conversation: ['vocab', 'reading', 'conversation'],
  vocabulary: ['vocab', 'kanji', 'grammar'],
  writing: ['kanji', 'grammar', 'writing'],
};

@Schema({ _id: false })
export class WeeklyItem {
  @Prop({ type: String, required: true })
  skill: SkillType;

  @Prop({ type: Types.ObjectId })
  refId?: Types.ObjectId;

  @Prop()
  refModel?: string;

  @Prop()
  title?: string;

  @Prop({ default: 1 })
  targetCount?: number;

  @Prop({ required: true })
  order: number;

  @Prop({ default: 15 })
  estimatedMinutes: number;

  @Prop()
  completedAt?: Date;
}

@Schema({ _id: false })
export class WeeklyPlan {
  @Prop({ required: true })
  week: number;

  @Prop({ type: [WeeklyItem], default: [] })
  items: WeeklyItem[];
}

@Schema({ _id: false })
export class LearningGoal {
  @Prop({ type: String, required: true })
  type: GoalType;

  @Prop({ type: [String], default: [] })
  types?: GoalType[];

  @Prop()
  examDate?: Date;

  @Prop()
  targetScore?: number;

  @Prop({ required: true })
  dailyMinutes: number;

  @Prop({ type: [String], required: true })
  focusSkills: SkillType[];
}

@Schema({ _id: false })
export class ReviewSuggestion {
  @Prop({ type: String, required: true })
  type: 'speed_up' | 'slow_down' | 'focus_skill' | 'add_review';

  @Prop({ type: String })
  skill?: SkillType;

  @Prop({ required: true })
  reason: string;
}

@Schema({ _id: false })
export class LastReview {
  @Prop({ required: true })
  reviewedAt: Date;

  @Prop({ required: true })
  assessment: string;

  @Prop()
  onTrack?: boolean;

  @Prop({ type: [ReviewSuggestion], default: [] })
  suggestions: ReviewSuggestion[];

  @Prop({ type: [WeeklyItem], default: [] })
  adjustedWeeklyItems?: WeeklyItem[];
}

@Schema({ timestamps: true })
export class LearningPath {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string;

  @Prop({ type: LearningGoal, required: true })
  goal: LearningGoal;

  @Prop({ type: [WeeklyPlan], default: [] })
  weeklyPlans: WeeklyPlan[];

  @Prop({ default: 1 })
  currentWeek: number;

  @Prop({ default: 0 })
  streakDays: number;

  @Prop({ type: String, enum: ['ai', 'fallback'], default: 'fallback' })
  generationSource: 'ai' | 'fallback';

  @Prop()
  generatedAt?: Date;

  @Prop()
  lastActiveAt?: Date;

  @Prop({ type: LastReview })
  lastReview?: LastReview;
}

export type LearningPathDocument = LearningPath & Document;
export const LearningPathSchema = SchemaFactory.createForClass(LearningPath);

LearningPathSchema.index({ userId: 1, createdAt: -1 });

