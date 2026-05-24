import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true, collection: "moderation_settings" })
export class ModerationSetting extends Document {
  @Prop({ type: String, required: true, unique: true, default: "default" })
  key: string;

  @Prop({ type: Number, required: true, default: 2, min: 1, max: 50 })
  postBatchSize: number;

  @Prop({ type: Number, required: true, default: 5, min: 1, max: 100 })
  commentBatchSize: number;

  @Prop({ type: Number, required: true, default: 30, min: 5, max: 300 })
  batchTimeoutSeconds: number;

  @Prop({ type: Number, required: true, default: 0.8, min: 0, max: 1 })
  autoDeleteConfidenceThreshold: number;
}

export const ModerationSettingSchema =
  SchemaFactory.createForClass(ModerationSetting);
