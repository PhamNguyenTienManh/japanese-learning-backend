import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';

@Schema({ timestamps: false }) // tự quản lý updated_at
export class UserStreak extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  current_streak: number; // số ngày học liên tục hiện tại

  @Prop({ type: Number, default: 0 })
  longest_streak: number; // chuỗi dài nhất từng đạt được

  @Prop({ type: Date, default: Date.now })
  updated_at: Date; // lần cập nhật cuối (ngày cuối cùng học)
}

export const UserStreakSchema = SchemaFactory.createForClass(UserStreak);
