import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

@Schema({ timestamps: true })
export class UserStreakHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Number, required: true })
  streak_count: number; // độ dài chuỗi (số ngày liên tục)

  @Prop({ type: Date, required: true })
  start_date: Date; // ngày bắt đầu chuỗi streak

  @Prop({ type: Date, required: true })
  end_date: Date; // ngày kết thúc chuỗi streak

  @Prop({ type: Boolean, default: false })
  is_current: boolean; // true nếu đây là streak hiện tại
}

export const UserStreakHistorySchema = SchemaFactory.createForClass(UserStreakHistory);
