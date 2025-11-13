import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';


interface Example {
  w: string; // chữ ví dụ
  m: string; // nghĩa
  p: string; // phát âm
}

@Schema({ timestamps: true })
export class JlptKanji extends Document {
  @Prop({ required: true, unique: true })
  kanji: string;

  @Prop({ required: true })
  mean: string;

  @Prop()
  detail: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  example_kun: Record<string, Example[]>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  example_on: Record<string, Example[]>;


  @Prop({ type: [{ w: String, m: String, p: String, h: String }] })
  examples: Example[];

  @Prop()
  kun: string;

  @Prop()
  on: string;

  @Prop()
  stroke_count: string;

  @Prop({ type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string;

  @Prop({ type: Boolean, default: false })
  isJlpt: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const JlptKanjiSchema = SchemaFactory.createForClass(JlptKanji);
