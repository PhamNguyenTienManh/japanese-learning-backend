import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

@Schema({ timestamps: true })
export class NotificationSetting extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop()
  mail_noti?: string; // ví dụ: địa chỉ email nhận thông báo

  @Prop({ type: Boolean, default: true })
  app_noti: boolean; // bật/tắt thông báo trong app

  @Prop({ type: Boolean, default: true })
  app_job_noti: boolean; // thông báo công việc

  @Prop({ type: Boolean, default: true })
  app_study_noti: boolean; // thông báo học tập

  @Prop({ type: Boolean, default: true })
  app_sale_noti: boolean; // thông báo khuyến mãi

  @Prop({ type: Boolean, default: true })
  mail_sale_noti: boolean; // nhận email về khuyến mãi

  @Prop({ type: Boolean, default: true })
  mail_job_noti: boolean; // nhận email về công việc

  @Prop({ type: Boolean, default: true })
  mail_study_noti: boolean; // nhận email về học tập
}

export const NotificationSettingSchema = SchemaFactory.createForClass(NotificationSetting);
