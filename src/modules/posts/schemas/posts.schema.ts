import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'posts' })
export class Posts extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId; // Người tạo bài viết

  @Prop({ type: String, required: true, trim: true })
  title: string; // Tiêu đề bài viết

  @Prop({ type: String, required: true })
  content: string; // Nội dung bài viết

  @Prop({ type: Types.ObjectId, ref: 'PostCategory',  required: true })
  category_id: Types.ObjectId; // Danh mục bài viết

  @Prop({ type: Number, default: 0, min: 0 })
  total_comment: number; // Tổng số bình luận

  @Prop({ type: Number, default: 1, min: 0 })
  total_follow: number; // Tổng số người theo dõi bài viết

  @Prop({ type: Number, default: 0, min: 0 })
  liked: number; // Số lượt thích

  // @Prop({ type: Number, default: 0, min: 0 })
  // dislike: number; // Số lượt không thích

  // @Prop({ type: Number, default: 0, min: 0 })
  // share: number; // Số lượt chia sẻ

  @Prop({ type: Number, default: 1 })
  status: number; 
  // 0 = ẩn, 1 = chờ duyệt, 2 = công khai,...

  // @Prop({ type: Number, default: 0 })
  // top: number; 
  // // 1 nếu bài viết được ghim/trending, 0 là bình thường

  // @Prop({ type: String })
  // image?: string; // Ảnh thumbnail (nếu có)

  // @Prop({ type: String })
  // link?: string; // Link đính kèm (nếu bài viết chia sẻ tài liệu ngoài)

  // @Prop({ type: Number, default: 0 })
  // review_status: number; 
  // // 0 = chưa duyệt, 1 = đã duyệt, 2 = từ chối, ...

}

export const PostSchema = SchemaFactory.createForClass(Posts);
