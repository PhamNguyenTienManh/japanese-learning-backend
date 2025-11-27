    import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Profile } from 'src/modules/profiles/schemas/profiles.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'comments' })
export class Comment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId; // Bài viết mà bình luận thuộc về

  @Prop({ type: Types.ObjectId, ref: Profile.name, required: true })
  profileId: Types.ObjectId; // Người bình luận

  @Prop({ type: String, required: true, trim: true })
  content: string; // Nội dung bình luận

  @Prop({ type: Number, default: 0, min: 0 })
  total_comment: number; 

  @Prop({ type: Number, default: 1 })
  status: number; 

  @Prop()
  liked: Types.ObjectId[]; // Tổng lượt thích bình luận

  @Prop({ type: String, default: null })
  image?: string | null; // Ảnh đính kèm (nếu có)

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean; // Đã xóa hay chưa (xóa mềm)
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
