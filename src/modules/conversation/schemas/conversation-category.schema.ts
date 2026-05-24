import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true, collection: "conversation_categories", id: false })
export class ConversationCategory extends Document {
  @Prop({ type: String, required: true, trim: true })
  declare id: string;

  @Prop({ type: String, required: true, trim: true })
  slug: string;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ConversationCategorySchema =
  SchemaFactory.createForClass(ConversationCategory);
