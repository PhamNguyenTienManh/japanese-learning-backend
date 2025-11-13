import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class JlptWord extends Document {
  @Prop({ required: true, unique: true })
  word: string; // VD: "食べる"

  @Prop({ type: [String], default: [] })
  phonetic: string[]; // cách đọc (VD: ["たべる", "タベル"])

  @Prop({
    required: true,
    enum: [
      'Danh từ',
      'Động từ',
      'Tính từ -i',
      'Tính từ -na',
      'Trạng từ',
      'Trợ từ',
      'Trợ động từ',
      'Định từ',
      'Liên từ',
      'Thán từ',
    ],
  })
  type: string; // loại từ (danh từ, động từ, ...)

  @Prop({
    type: [
      {
        meaning: { type: String, required: true }, // nghĩa tiếng Việt hoặc tiếng Anh
        examples: {
          type: [
            {
              jp: { type: String, required: true }, // câu ví dụ tiếng Nhật
              vi: { type: String }, // nghĩa tiếng Việt của ví dụ
            },
          ],
          default: [],
        },
      },
    ],
    default: [],
  })
  meanings: {
    meaning: string;
    examples: { jp: string; vi?: string }[];
  }[];

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string; // cấp độ JLPT

  @Prop({ type: Boolean, default: false })
  isJlpt: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const JlptWordSchema = SchemaFactory.createForClass(JlptWord);
