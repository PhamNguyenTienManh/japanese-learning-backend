import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// -----------------------------------
// Subdocument: Answer
// -----------------------------------
@Schema({ _id: false })
export class UserAnswer {
  @Prop({ type: Types.ObjectId, ref: 'ExamQuestion', required: true })
  questionId: Types.ObjectId; // Tham chiếu đến câu hỏi gốc

  @Prop({ type: Number, required: true })
  selectedAnswer: number; // Index đáp án người dùng chọn

  @Prop({ type: Boolean, default: false })
  isCorrect: boolean; // Đáp án đúng hay sai
}

export const UserAnswerSchema = SchemaFactory.createForClass(UserAnswer);

// -----------------------------------
// Main Schema: ExamUserAnswer
// -----------------------------------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'exam_user_answers' })
export class ExamUserAnswer extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ExamResult', required: true })
  examResultId: Types.ObjectId; // Tham chiếu đến exam_results

  @Prop({ type: Types.ObjectId, ref: 'ExamPart', required: true })
  partId: Types.ObjectId; // Tham chiếu đến phần của bài thi

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // Ai làm bài thi này

  @Prop({ type: [UserAnswerSchema], default: [] })
  answers: UserAnswer[]; // Danh sách các câu hỏi và đáp án người dùng chọn

  @Prop({ type: Number, required: true, min: 0 })
  score: number; // Điểm đạt được trong phần này
}

export const ExamUserAnswerSchema = SchemaFactory.createForClass(ExamUserAnswer);
