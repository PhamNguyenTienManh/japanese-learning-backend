import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { SkillType } from './learning-path.schema';

export type ResourceProgressSkill = Extract<SkillType, 'reading' | 'writing'>;

@Schema({ timestamps: true, collection: 'learning_resource_progress' })
export class LearningResourceProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['reading', 'writing'], index: true })
  skill: ResourceProgressSkill;

  @Prop({ type: String, required: true })
  refKey: string;

  @Prop({ type: String })
  level?: string;

  @Prop({ type: String, required: true, index: true })
  weekKey: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export type LearningResourceProgressDocument = LearningResourceProgress & Document;
export const LearningResourceProgressSchema =
  SchemaFactory.createForClass(LearningResourceProgress);

LearningResourceProgressSchema.index({
  userId: 1,
  skill: 1,
  weekKey: 1,
  refKey: 1,
});
