import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

@Schema({ timestamps: true })
export class UserWord extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  content: string; // VD: "ありがとう"

  @Prop()
  type?: string; // VD: "noun", "verb", "adj"

  @Prop({ required: true })
  mean: string; // VD: "Cảm ơn"

  @Prop()
  phonetic?: string; // VD: "[a-ri-ga-to-u]"
}

export const UserWordSchema = SchemaFactory.createForClass(UserWord);
