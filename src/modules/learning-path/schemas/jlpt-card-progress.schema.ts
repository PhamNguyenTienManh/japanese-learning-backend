import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { SkillType } from './learning-path.schema';

@Schema({ timestamps: true })
export class JlptCardProgress extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['vocab', 'grammar', 'kanji'] })
  skill: Extract<SkillType, 'vocab' | 'grammar' | 'kanji'>;

  @Prop({ type: String, required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string;

  @Prop({ type: Types.ObjectId, required: true })
  refId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['known', 'unknown'] })
  status: 'known' | 'unknown';
}

export type JlptCardProgressDocument = JlptCardProgress & Document;
export const JlptCardProgressSchema = SchemaFactory.createForClass(JlptCardProgress);

JlptCardProgressSchema.index(
  { userId: 1, skill: 1, refId: 1 },
  { unique: true },
);
