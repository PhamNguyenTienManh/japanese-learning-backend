import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ExamDocument = Exam & Document;

export enum ExamStatus {
  DRAFT = "draft", // mới tạo
  COMPLETED = "completed", // đã hoàn thiện
  PUBLIC = "published", // công khai
  HIDDEN = "hidden", // ẩn
}

@Schema({ timestamps: true })
export class Exam extends Document {
  @Prop({ required: true })
  title: string; // Test name (e.g., "Test 1")

  @Prop({ required: true, enum: ["N5", "N4", "N3", "N2", "N1"] })
  level: string; // JLPT level

  @Prop({ required: true, min: 0, default: 180 })
  score: number; // Total maximum score

  @Prop({ required: true, min: 0, default: 80 })
  pass_score: number; // Minimum passing score

  @Prop({ required: true, enum: ExamStatus, default: ExamStatus.DRAFT })
  status: ExamStatus; // Exam status (draft, completed, public, hidden)
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
