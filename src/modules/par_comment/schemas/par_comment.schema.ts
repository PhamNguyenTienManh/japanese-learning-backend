import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'par_comments' })
export class ParComment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Comment', required: true })
  commentId: Types.ObjectId; // Bình luận cha mà reply này thuộc về

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // Người đã bình luận trả lời

  @Prop({ type: String, required: true, trim: true })
  content: string; // Nội dung trả lời bình luận

  @Prop({ type: Number, default: 1 })
  status: number; 
  // 1 = hiển thị, 0 = ẩn, 2 = chờ duyệt (nếu cần moderation)

  @Prop({ type: Number, default: 0, min: 0 })
  liked: number; // Lượt thích của bình luận con

  @Prop({ type: String, default: null })
  image?: string | null; // Ảnh đính kèm (nếu có)

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean; // Xóa mềm
}

export const ParCommentSchema = SchemaFactory.createForClass(ParComment);
