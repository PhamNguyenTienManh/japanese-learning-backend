import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

@Schema({ timestamps: true })
export class SearchHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  content: string; // VD: "人"

  @Prop({ required: true, enum: ['word', 'kanji', 'grammar'] })
  type: string; // Loại tra cứu

  @Prop()
  mean?: string; // VD: "con người; nhân loại"

  @Prop()
  phonetic?: string; // VD: "たり と ヒト にん じん ひと り"

  @Prop({ type: Number, default: 1 })
  search_count: number; // Số lần đã tra từ này

  @Prop({ type: Date, default: Date.now })
  last_search: Date; // Lần tra gần nhất
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);
