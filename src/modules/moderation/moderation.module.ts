import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ModerationController } from "./moderation.controller";
import { ModerationService } from "./moderation.service";
import {
  ModerationCase,
  ModerationCaseSchema,
} from "./schemas/moderation-case.schema";
import {
  ModerationAiEvaluation,
  ModerationAiEvaluationSchema,
} from "./schemas/moderation-ai-evaluation.schema";
import {
  ModerationSetting,
  ModerationSettingSchema,
} from "./schemas/moderation-setting.schema";
import { Posts, PostSchema } from "../posts/schemas/posts.schema";
import { Comment, CommentSchema } from "../comments/schemas/comments.schema";
import {
  ParComment,
  ParCommentSchema,
} from "../par_comment/schemas/par_comment.schema";
import { Profile, ProfileSchema } from "../profiles/schemas/profiles.schema";
import { AiModule } from "../ai/ai.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModerationCase.name, schema: ModerationCaseSchema },
      {
        name: ModerationAiEvaluation.name,
        schema: ModerationAiEvaluationSchema,
      },
      { name: ModerationSetting.name, schema: ModerationSettingSchema },
      { name: Posts.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: ParComment.name, schema: ParCommentSchema },
      { name: Profile.name, schema: ProfileSchema },
    ]),
    AiModule,
    NotificationsModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
