import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ----------------------------
// Subdocument: Example
// ----------------------------
@Schema({ _id: false })
export class Example {
  @Prop({ required: true })
  content: string; // câu ví dụ (VD: "毎日日本語を勉強します。")

  @Prop()
  transcription?: string; // cách đọc (nếu có)

  @Prop()
  meaning?: string; // nghĩa tiếng Việt / Anh
}

export const ExampleSchema = SchemaFactory.createForClass(Example);

// ----------------------------
// Subdocument: Usage
// ----------------------------
@Schema({ _id: false })
export class Usage {
  @Prop()
  explain?: string; // Giải thích ngữ pháp

  @Prop()
  synopsis?: string; // Tóm tắt hoặc công thức

  @Prop({ type: [ExampleSchema], default: [] })
  examples: Example[]; // Danh sách ví dụ
}

export const UsageSchema = SchemaFactory.createForClass(Usage);

// ----------------------------
// Main Schema: JLPT Grammar
// ----------------------------
@Schema({ timestamps: true })
export class JlptGrammar extends Document {
  @Prop({ required: true, enum: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  level: string; // cấp độ JLPT

  @Prop({ required: true })
  title: string; // tiêu đề / mẫu ngữ pháp (VD: "~たことがある")

  @Prop({ type: [UsageSchema], default: [] })
  usages: Usage[]; // danh sách cách dùng, ví dụ
}

export const JlptGrammarSchema = SchemaFactory.createForClass(JlptGrammar);
