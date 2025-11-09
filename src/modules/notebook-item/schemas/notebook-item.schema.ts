import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class NotebookItem extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Notebook', required: true })
  notebook_id: Types.ObjectId; // tham chiếu đến Notebook

  @Prop({ required: true, enum: ['kanji', 'word', 'grammar'] })
  type: string; // loại nội dung

  @Prop({ type: Types.ObjectId, refPath: 'type', default: null })
  ref_id?: Types.ObjectId | null; 
  // liên kết đến jlpt_kanji / jlpt_word / jlpt_grammar 
  // hoặc null / -1 nếu là từ do user tự thêm

  @Prop()
  notes?: string; // ghi chú của người dùng

  @Prop({ required: true })
  name: string; // tên / từ chính (VD: 食べる, 人, ～たことがある)

  @Prop()
  mean?: string; // nghĩa

  @Prop()
  phonetic?: string; // cách đọc

  @Prop({ default: false })
  remember: boolean; // đánh dấu đã nhớ
}

export const NotebookItemSchema = SchemaFactory.createForClass(NotebookItem);
