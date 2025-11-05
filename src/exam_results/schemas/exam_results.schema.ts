import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'exam_results' })
export class ExamResult extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
  examId: Types.ObjectId; // Bài thi nào

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // Ai làm bài thi này

  @Prop({ type: Date, required: true })
  start_time: Date; // Thời gian bắt đầu làm bài

  @Prop({ type: Date, required: true })
  end_time: Date; // Thời gian kết thúc làm bài

  @Prop({ type: Number, required: true, min: 0 })
  duration: number; // Thời lượng làm bài (giây hoặc phút)

  @Prop({ type: Number, required: true, min: 0 })
  total_score: number; // Tổng điểm đạt được

  @Prop({ type: Boolean, default: false })
  passed: boolean; // True nếu vượt qua bài thi

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ExamResultDetail' }], default: [] })
  details: Types.ObjectId[]; // Danh sách điểm từng phần (ref đến ExamResultDetail)
}

export const ExamResultSchema = SchemaFactory.createForClass(ExamResult);
