import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ _id: false })
class ConversationLessonCategory {
  @Prop({ type: String, required: true, trim: true })
  id: string;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: Number, default: 0 })
  order: number;
}

@Schema({ _id: false })
class ConversationLine {
  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: String, required: true })
  japanese: string;

  @Prop({ type: String, required: true })
  kana: string;

  @Prop({ type: String, required: true })
  vietnamese: string;
}

@Schema({ timestamps: true, collection: "conversation_lessons" })
export class ConversationLesson extends Document {
  @Prop({ type: ConversationLessonCategory, required: true })
  category: ConversationLessonCategory;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, required: true, trim: true })
  level: string;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String, default: "" })
  image: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Boolean, default: true })
  published: boolean;

  @Prop({ type: [ConversationLine], default: [] })
  lines: ConversationLine[];
}

export const ConversationLessonSchema =
  SchemaFactory.createForClass(ConversationLesson);

