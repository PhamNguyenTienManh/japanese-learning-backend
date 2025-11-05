import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Notebook extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId; // người sở hữu sổ tay

  @Prop({ required: true })
  name: string; // tên sổ tay (VD: "Từ vựng N3", "Ngữ pháp quan trọng")

  @Prop({ default: false })
  isPubliced: boolean; // true nếu được chia sẻ công khai

  @Prop({ default: 0, min: 0 })
  viewCount: number; // tổng lượt xem từ người khác
}

export const NotebookSchema = SchemaFactory.createForClass(Notebook);
