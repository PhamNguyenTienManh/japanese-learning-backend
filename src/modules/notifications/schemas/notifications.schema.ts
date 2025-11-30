import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Posts } from 'src/modules/posts/schemas/posts.schema';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  fromProfileId: Types.ObjectId;

  // // Loại thông báo
  // @Prop({
  //   type: String,
  //   enum: ['comment', 'like', 'event', 'exam', 'article'],
  //   required: true,
  // })
  // type: string;

  @Prop({ type: Types.ObjectId, ref: Posts.name })
  targetId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
