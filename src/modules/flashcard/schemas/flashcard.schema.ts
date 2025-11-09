import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Flashcard extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId; // người sở hữu flashcard

  @Prop({ required: true, enum: ['kanji', 'word', 'grammar', 'notebook'] })
  type: string; // loại nội dung của flashcard

  @Prop({ type: Types.ObjectId, refPath: 'type', required: true })
  ref_id: Types.ObjectId; 
  // tham chiếu động tới jlpt_kanji / jlpt_word / jlpt_grammar / notebook

  @Prop({ default: false })
  isLearned: boolean; // người dùng đã học hay chưa
}

export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
