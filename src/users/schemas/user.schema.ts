import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ unique: true, required: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['student', 'admin'], default: 'student' })
  role: string;

  @Prop({ required: true, enum: ['active', 'locked', 'pending'], default: 'pending' })
  status: string;

  @Prop()
  premium_date?: Date;

  @Prop()
  premium_expired_date?: Date;

  @Prop({ default: Date.now })
  registeredAt: Date;

  @Prop()
  lastLogin?: Date;

  @Prop({ required: true, enum: ['local', 'google', 'facebook'], default: 'local' })
  provider: string;

  @Prop()
  google_id?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
