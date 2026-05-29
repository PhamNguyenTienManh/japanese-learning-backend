import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from "mongoose";
import { User } from "src/modules/users/schemas/user.schema";

export enum UserActivityType {
  STUDY_TIME_ADDED = "study_time_added",
  EXAM_COMPLETED = "exam_completed",
  POST_CREATED = "post_created",
  COMMENT_CREATED = "comment_created",
  NOTEBOOK_CREATED = "notebook_created",
  NOTEBOOK_ITEM_ADDED = "notebook_item_added",
  DICTIONARY_LOOKED_UP = "dictionary_looked_up",
}

export enum UserActivityTargetType {
  DASHBOARD = "dashboard",
  EXAM_RESULT = "exam_result",
  POST = "post",
  NOTEBOOK = "notebook",
  NOTEBOOK_FLASHCARDS = "notebook_flashcards",
  DICTIONARY = "dictionary",
  JLPT = "jlpt",
  CHAT = "chat",
}

@Schema({ timestamps: true, collection: "user_activities" })
export class UserActivity extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(UserActivityType) })
  type: UserActivityType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(UserActivityTargetType),
    default: UserActivityTargetType.DASHBOARD,
  })
  target_type: UserActivityTargetType;

  @Prop({ type: Types.ObjectId, default: null })
  target_id?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  route_params: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);

UserActivitySchema.index({ user_id: 1, createdAt: -1 });
UserActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });
