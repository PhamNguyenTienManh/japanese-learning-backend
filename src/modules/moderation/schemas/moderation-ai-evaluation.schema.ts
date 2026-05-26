import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import {
  ModerationCategory,
  ModerationReviewDecision,
  ModerationStatus,
} from "./moderation-case.schema";

export type ModerationAiDecisionStatus =
  | "approved"
  | Extract<ModerationStatus, "pending" | "auto_deleted">;

@Schema({ timestamps: true, collection: "moderation_ai_evaluations" })
export class ModerationAiEvaluation extends Document {
  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ type: Boolean, required: true })
  isViolation: boolean;

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

  @Prop({ type: Number, required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({
    type: String,
    required: true,
    enum: ["approved", "pending", "auto_deleted"],
  })
  decisionStatus: ModerationAiDecisionStatus;

  @Prop({ type: String, default: "" })
  reason: string;

  @Prop({ type: Types.ObjectId, default: null, ref: "ModerationCase" })
  moderationCaseId?: Types.ObjectId | null;

  @Prop({
    type: String,
    default: null,
    enum: ["confirmed_violation", "rejected_violation", null],
  })
  reviewDecision?: ModerationReviewDecision | null;

  @Prop({ type: Types.ObjectId, default: null, ref: "ModerationCase" })
  reviewedCaseId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;
}

export const ModerationAiEvaluationSchema = SchemaFactory.createForClass(
  ModerationAiEvaluation,
);

ModerationAiEvaluationSchema.index({ targetId: 1, createdAt: -1 });
ModerationAiEvaluationSchema.index({ decisionStatus: 1, createdAt: -1 });
ModerationAiEvaluationSchema.index({ reviewDecision: 1, createdAt: -1 });
ModerationAiEvaluationSchema.index({ confidence: -1, createdAt: -1 });
