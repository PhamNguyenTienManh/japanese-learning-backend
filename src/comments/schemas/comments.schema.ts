    import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'comments' })
export class Comment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId; // Bài viết mà bình luận thuộc về

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // Người bình luận

  @Prop({ type: String, required: true, trim: true })
  content: string; // Nội dung bình luận

  @Prop({ type: Number, default: 0, min: 0 })
  total_comment: number; 
  // Số lượng bình luận con (reply) của bình luận này

  @Prop({ type: Number, default: 1 })
  status: number; 
  // 1 = hiển thị, 0 = ẩn, 2 = chờ duyệt (tùy logic bạn muốn)

  @Prop({ type: Number, default: 0, min: 0 })
  liked: number; // Tổng lượt thích bình luận

  @Prop({ type: String, default: null })
  image?: string | null; // Ảnh đính kèm (nếu có)

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean; // Đã xóa hay chưa (xóa mềm)
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
