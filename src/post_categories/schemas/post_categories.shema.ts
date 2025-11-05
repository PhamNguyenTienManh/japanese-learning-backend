import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'post_categories' })
export class PostCategory extends Document {
  @Prop({ type: String, required: true, trim: true, unique: true })
  name: string; // Tên danh mục (vd: "Ngữ pháp", "Từ vựng", "Kinh nghiệm học")

  @Prop({ type: Number, default: 0, min: 0 })
  follow: number; // Số lượng người theo dõi danh mục
}

export const PostCategorySchema = SchemaFactory.createForClass(PostCategory);
