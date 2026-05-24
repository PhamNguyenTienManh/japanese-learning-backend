import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import {
  ConversationCategory,
  ConversationCategorySchema,
} from "./schemas/conversation-category.schema";
import {
  ConversationLesson,
  ConversationLessonSchema,
} from "./schemas/conversation-lesson.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationCategory.name, schema: ConversationCategorySchema },
      { name: ConversationLesson.name, schema: ConversationLessonSchema },
    ]),
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}

