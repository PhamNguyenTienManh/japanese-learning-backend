import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ModerationTargetType = "post" | "comment" | "reply_comment";
export type ModerationSource = "rulebase" | "ai";
export type ModerationStatus =
  | "pending"
  | "auto_deleted"
  | "approved_deleted"
  | "dismissed"
  | "restored";

export type ModerationCategory =
  | "spam_advertising"
  | "abusive_language"
  | "off_topic"
  | "language_misinformation"
  | "nsfw"
  | "manipulation";

@Schema({ timestamps: true, collection: "moderation_cases" })
export class ModerationCase extends Document {
  @Prop({ required: true, enum: ["post", "comment", "reply_comment"] })
  targetType: ModerationTargetType;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  parentPostId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  authorId?: Types.ObjectId | null;

  @Prop({ type: String, default: "" })
  authorName: string;

  @Prop({ type: String, default: "" })
  title: string;

  @Prop({ type: String, required: true })
  contentSnapshot: string;

  @Prop({ required: true, enum: ["rulebase", "ai"] })
  source: ModerationSource;

  @Prop({
    type: String,
    default: null,
    enum: [
      "spam_advertising",
      "abusive_language",
      "off_topic",
      "language_misinformation",
      "nsfw",
      "manipulation",
      null,
    ],
  })
  category?: ModerationCategory | null;

  @Prop({ type: Number, default: null })
  confidence?: number | null;

  @Prop({
    required: true,
    enum: ["pending", "auto_deleted", "approved_deleted", "dismissed", "restored"],
    default: "pending",
  })
  status: ModerationStatus;

  @Prop({ type: String, default: "" })
  reason: string;

  @Prop({ type: [String], default: [] })
  matchedTerms: string[];

  @Prop({ type: Object, default: null })
  aiRawOutput?: Record<string, unknown> | null;

  @Prop({ type: Date, default: null })
  actionAt?: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  actionBy?: Types.ObjectId | null;
}

export const ModerationCaseSchema =
  SchemaFactory.createForClass(ModerationCase);

ModerationCaseSchema.index({ status: 1, createdAt: -1 });
ModerationCaseSchema.index({ targetType: 1, targetId: 1, status: 1 });
ModerationCaseSchema.index({ parentPostId: 1 });
