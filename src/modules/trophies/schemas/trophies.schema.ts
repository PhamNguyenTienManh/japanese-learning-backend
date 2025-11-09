import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Trophy extends Document {
  @Prop({ required: true, unique: true })
  name: string; // VD: "Chăm học tiếng Nhật"

  @Prop({ required: true })
  description: string; // VD: "Đăng nhập 14 ngày liên tiếp"

  @Prop({ required: true, min: 1 })
  require: number; // Số ngày cần đạt được huy hiệu
}

export const TrophySchema = SchemaFactory.createForClass(Trophy);
