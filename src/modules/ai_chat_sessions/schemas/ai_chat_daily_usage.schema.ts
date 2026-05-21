import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true, collection: "ai_chat_daily_usage" })
export class AIChatDailyUsage extends Document {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  dateKey: string;

  @Prop({ type: Number, default: 0 })
  used: number;

  @Prop({ type: Number, default: 50 })
  limit: number;
}

export const AIChatDailyUsageSchema =
  SchemaFactory.createForClass(AIChatDailyUsage);

AIChatDailyUsageSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
