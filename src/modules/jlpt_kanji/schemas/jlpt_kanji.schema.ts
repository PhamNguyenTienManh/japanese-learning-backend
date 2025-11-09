import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class JlptKanji extends Document {
  @Prop({ required: true, unique: true })
  kanji: string; // VD: "日"

  @Prop()
  mean?: string; // VD: "mặt trời; ngày"

  @Prop()
  detail?: string; // mô tả chi tiết hoặc nghĩa mở rộng

  @Prop({
    type: [
      {
        w: { type: String }, // ví dụ: "七日"
        m: { type: String }, // nghĩa: "7 ngày"
        p: { type: String }, // phát âm: "なのか"
        h: { type: String }, // Hán Việt: "THẤT NHẬT"
      },
    ],
    default: [],
  })
  example: {
    w: string;
    m: string;
    p: string;
    h: string;
  }[];

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string; // cấp độ JLPT

  @Prop()
  kun?: string; // cách đọc thuần Nhật

  @Prop()
  on?: string; // cách đọc Hán Nhật

  @Prop({ type: Number })
  freq?: number; // tần suất xuất hiện

  @Prop()
  stroke_count?: string; // số nét viết
}

export const JlptKanjiSchema = SchemaFactory.createForClass(JlptKanji);
