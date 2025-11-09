import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class JlptWord extends Document {
  @Prop({ required: true, unique: true })
  word: string; // VD: "食べる"

  @Prop()
  phonetic?: string; // cách đọc (VD: "たべる")

  @Prop()
  mean?: string; // nghĩa tiếng Việt hoặc tiếng Anh

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string; // cấp độ JLPT
}

export const JlptWordSchema = SchemaFactory.createForClass(JlptWord);
