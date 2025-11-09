import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ExamResultDetail extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ExamResult', required: true })
  examResultId: Types.ObjectId; // Kết quả tổng của bài thi

  @Prop({ type: Types.ObjectId, ref: 'ExamPart', required: true })
  partId: Types.ObjectId; // Phần thi (Từ vựng / Ngữ pháp / Nghe)

  @Prop({ required: true, min: 0 })
  score: number; // Số điểm đạt được trong phần đó
}

export const ExamResultDetailSchema = SchemaFactory.createForClass(ExamResultDetail);
