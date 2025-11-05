import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Exam extends Document {
  @Prop({ required: true })
  title: string; // Tên bài thi (VD: "Test 1")

  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string; // Cấp độ JLPT

  @Prop({ required: true, min: 0 })
  score: number; // Tổng điểm tối đa

  @Prop({ required: true, min: 0 })
  pass_score: number; // Điểm cần để đạt
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
