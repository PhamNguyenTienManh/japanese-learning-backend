import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ExamPart extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId; // Tham chiếu đến bài thi cha

  @Prop({ required: true, enum: ['Từ vựng', 'Ngữ pháp - Đọc hiểu', 'Thi nghe']})
  name: string; // Tên phần thi (VD: Từ vựng,Ngữ pháp - Đọc hiểu,Thi nghe)

  @Prop({ required: true, min: 1 })
  time: number; // Thời gian làm phần (phút)

  @Prop({ required: true, min: 0 })
  min_score: number; // Điểm tối thiểu phần này

  @Prop({ required: true, min: 0 })
  max_score: number; // Điểm tối đa phần này
}

export const ExamPartSchema = SchemaFactory.createForClass(ExamPart);
