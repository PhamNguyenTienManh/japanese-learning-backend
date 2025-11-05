import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // người nhận thông báo

  @Prop({
    type: String,
    enum: ['comment', 'event', 'exam', 'article'],
    required: true,
  })
  type: string; // loại thông báo

  @Prop({ type: String, required: true })
  title: string; // tiêu đề ngắn gọn của thông báo

  @Prop({ type: String, required: true })
  message: string; // nội dung chính

  @Prop({ type: Boolean, default: false })
  isRead: boolean; // đã đọc hay chưa
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
