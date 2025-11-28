import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';


@Schema({ timestamps: true })
export class UserStudyDay extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date: Date; // ngày học (chỉ lấy phần date, không cần giờ)

  @Prop({ type: Number, default: 0 })
  duration_minutes: number; // tổng số phút học trong ngày
}

export const UserStudyDaySchema = SchemaFactory.createForClass(UserStudyDay);
