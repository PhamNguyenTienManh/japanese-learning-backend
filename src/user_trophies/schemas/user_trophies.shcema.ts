import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Trophy } from 'src/trophies/schemas/trophies.schema';

@Schema({ timestamps: false }) // tự quản lý update_time, không cần timestamps tự động
export class UserTrophy extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Trophy.name, required: true })
  trophy_id: Types.ObjectId;

  @Prop({ type: Number, enum: [0, 1], default: 0 })
  achieved: number; // 1 = đã đạt, 0 = chưa đạt

  @Prop({ type: Number, required: true })
  update_time: number; // ví dụ: timestamp dạng 1728868267
}

export const UserTrophySchema = SchemaFactory.createForClass(UserTrophy);
