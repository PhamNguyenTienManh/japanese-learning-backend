import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { PlacementLevel, PlacementSkill } from './placement-question.schema';

export type PlacementSkillCounts = Record<PlacementSkill, number>;
export type PlacementLevelCounts = Record<PlacementLevel, number>;
export type PlacementTestSkillMatrix = Record<PlacementLevel, PlacementSkillCounts>;

@Schema({ timestamps: true })
export class PlacementTestConfig extends Document {
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ required: true, min: 1 })
  totalQuestions: number;

  @Prop({ type: Object, required: true, default: {} })
  levelCounts: PlacementLevelCounts;

  @Prop({ type: Object, required: true, default: {} })
  skillCounts: PlacementTestSkillMatrix;

  @Prop({ required: true, min: 30, max: 120, default: 90 })
  secondsPerQuestion: number;

  @Prop({ default: true })
  isActive: boolean;
}

export type PlacementTestConfigDocument = PlacementTestConfig & Document;
export const PlacementTestConfigSchema = SchemaFactory.createForClass(PlacementTestConfig);

PlacementTestConfigSchema.index({ key: 1 }, { unique: true });
