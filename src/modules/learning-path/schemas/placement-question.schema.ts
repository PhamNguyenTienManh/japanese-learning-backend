import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SkillType } from './learning-path.schema';

export type PlacementLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type PlacementSkill = Extract<SkillType, 'vocab' | 'grammar'>;

@Schema({ timestamps: true })
export class PlacementQuestion extends Document {
  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], required: true, validate: [(v: string[]) => v.length === 4, 'options must have 4 choices'] })
  options: string[];

  @Prop({ required: true, min: 0, max: 3 })
  correctAnswer: number;

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: PlacementLevel;

  @Prop({ required: true, enum: ['vocab', 'grammar'] })
  skill: PlacementSkill;

  @Prop({ required: true })
  explanation: string;
}

export type PlacementQuestionDocument = PlacementQuestion & Document;
export const PlacementQuestionSchema = SchemaFactory.createForClass(PlacementQuestion);

PlacementQuestionSchema.index({ level: 1, skill: 1 });
