import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// -----------------------------------
// Subdocument: General (thông tin chung của phần thi)
// -----------------------------------
@Schema({ _id: false })
export class GeneralInfo {
  @Prop()
  audio?: string; // file audio chính (nếu có)

  @Prop()
  image?: string; // ảnh minh họa (nếu có)

  @Prop()
  txt_read?: string; // đoạn đọc hoặc bài đọc (nếu có)

  @Prop({ type: [{ audio_time: { type: Number, default: null } }], default: [] })
  audios?: { audio_time: number | null }[]; // danh sách audio kèm thời gian
}

export const GeneralInfoSchema = SchemaFactory.createForClass(GeneralInfo);

// -----------------------------------
// Subdocument: Content (chi tiết từng câu hỏi)
// -----------------------------------
@Schema({ _id: false })
export class QuestionContent {
  @Prop({ required: true })
  question: string; // câu hỏi

  @Prop({ type: [String], required: true })
  answers: string[]; // danh sách đáp án

  @Prop({ required: true, min: 0 })
  correctAnswer: number; // chỉ số đáp án đúng

  @Prop()
  explain?: string; // lời giải ngắn

  @Prop()
  image?: string; // ảnh minh họa câu hỏi (nếu có)

  @Prop()
  explainAll?: string; // lời giải chi tiết
}

export const QuestionContentSchema = SchemaFactory.createForClass(QuestionContent);

// -----------------------------------
// Main Schema: ExamQuestion
// -----------------------------------
@Schema({ timestamps: true })
export class ExamQuestion extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ExamPart', required: true })
  partId: Types.ObjectId; // liên kết đến phần thi

  @Prop({ required: true })
  title: string; // tiêu đề câu hỏi (VD: "＿＿の　ことばは...")

  @Prop()
  kind?: string; // loại câu hỏi (VD: "cách đọc kanji")

  @Prop({ required: true, min: 1 })
  level: number; // cấp độ (5 tương ứng N5)

  @Prop({ required: true, min: 1 })
  count_question: number; // tổng số câu hỏi trong phần này

  @Prop({ type: GeneralInfoSchema, default: {} })
  general: GeneralInfo; // thông tin chung (audio, image, text...)

  @Prop({ type: [QuestionContentSchema], default: [] })
  content: QuestionContent[]; // danh sách câu hỏi chi tiết

  @Prop({ type: [Number], default: [] })
  correct_answers: number[]; // danh sách chỉ số đáp án đúng (nếu gộp nhiều câu)

  @Prop({ default: 0 })
  score_difficult?: number; // độ khó của phần này

  @Prop({ type: [Number], default: [] })
  scores: number[]; // điểm tương ứng cho từng câu hỏi
}

export const ExamQuestionSchema = SchemaFactory.createForClass(ExamQuestion);
