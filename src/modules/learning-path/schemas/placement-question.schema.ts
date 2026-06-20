import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlacementLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type PlacementSkill = 'vocab' | 'grammar' | 'listening';

@Schema({ _id: false })
export class PlacementAudioScriptLine {
  @Prop()
  speakerLabel?: string;

  @Prop()
  speakerId?: number;

  @Prop()
  text?: string;
}

export const PlacementAudioScriptLineSchema = SchemaFactory.createForClass(PlacementAudioScriptLine);

@Schema({ _id: false })
export class PlacementAudioScript {
  @Prop({ enum: ['single', 'dialogue'], default: 'single' })
  mode?: 'single' | 'dialogue';

  @Prop({ type: [PlacementAudioScriptLineSchema], default: [] })
  lines?: PlacementAudioScriptLine[];

  @Prop({ default: 500 })
  pauseMs?: number;
}

export const PlacementAudioScriptSchema = SchemaFactory.createForClass(PlacementAudioScript);

@Schema({ _id: false })
export class PlacementQuestionGeneral {
  @Prop()
  audio?: string;

  @Prop()
  image?: string;

  @Prop()
  txt_read?: string;

  @Prop({ type: PlacementAudioScriptSchema, default: null })
  audioScript?: PlacementAudioScript;
}

export const PlacementQuestionGeneralSchema =
  SchemaFactory.createForClass(PlacementQuestionGeneral);

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

  @Prop({ required: true, enum: ['vocab', 'grammar', 'listening'] })
  skill: PlacementSkill;

  @Prop({ type: PlacementQuestionGeneralSchema, default: {} })
  general?: PlacementQuestionGeneral;

  @Prop({ required: true })
  explanation: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ enum: ['easy', 'medium', 'hard'], default: 'medium' })
  difficulty?: 'easy' | 'medium' | 'hard';

  @Prop({ type: [String], default: [] })
  tags?: string[];
}

export type PlacementQuestionDocument = PlacementQuestion & Document;
export const PlacementQuestionSchema = SchemaFactory.createForClass(PlacementQuestion);

PlacementQuestionSchema.index({ level: 1, skill: 1, isActive: 1 });
