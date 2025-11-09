import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

@Schema({ timestamps: true })
export class Profile extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop()
  birthday?: Date;

  @Prop({ enum: [0, 1], default: 1 }) // 0 = female, 1 = male (hoặc ngược lại tùy bạn quy ước)
  sex: number;

  @Prop()
  job?: string;

  @Prop()
  introduction?: string;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
