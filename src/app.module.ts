import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { UsersModule } from "./modules/users/users.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { TrophiesModule } from "./modules/trophies/trophies.module";
import { UserTrophiesModule } from "./modules/user_trophies/user_trophies.module";
import { UserWordsModule } from "./modules/user_words/user_words.module";
import { SearchHistoryModule } from "./modules/search_history/search_history.module";
import { UserStreaksModule } from "./modules/user_streaks/user_streaks.module";
import { UserStreakHistoryModule } from "./modules/user_streak_history/user_streak_history.module";
import { UserNotificationsModule } from "./modules/user_notifications/user_notifications.module";
import { JlptKanjiModule } from "./modules/jlpt_kanji/jlpt_kanji.module";
import { JlptWordModule } from "./modules/jlpt_word/jlpt_word.module";
import { JlptGrammarModule } from "./modules/jlpt_grammar/jlpt_grammar.module";
import { NotebookModule } from "./modules/notebook/notebook.module";
import { NotebookItemModule } from "./modules/notebook-item/notebook-item.module";
import { FlashcardModule } from "./modules/flashcard/flashcard.module";
import { ExamsModule } from "./modules/exams/exams.module";
import { ExamsPartModule } from "./modules/exams_part/exams_part.module";
import { ExamQuestionModule } from "./modules/exam_question/exam_question.module";
import { ExamResultsModule } from "./modules/exam_results/exam_results.module";
import { ExamResultsDetailModule } from "./modules/exam_results_detail/exam_results_detail.module";
import { ExamUserAnswersModule } from "./modules/exam_user_answers/exam_user_answers.module";
import { PostsModule } from "./modules/posts/posts.module";
import { PostCategoriesModule } from "./modules/post_categories/post_categories.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { ParCommentModule } from "./modules/par_comment/par_comment.module";
import { NewsModule } from "./modules/news/news.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AiChatSessionsModule } from "./modules/ai_chat_sessions/ai_chat_sessions.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/auth.guard";
import { RolesGuard } from "./modules/auth/roles.guard";
import { UploadModule } from "./modules/upload/upload.module";
import { TextToSpeechModule } from "./modules/text_to_speech/text_to_speech.module";
import { CacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-yet";
import { RedisModule } from "./redis.module";
import { ContributionModule } from "./modules/contribution/contribution.module";
import { UserStudyDayModule } from "./modules/user_study_day/user_study_day.modules";
import { StatisticModule } from "./modules/statistic/statistic.module";

import { TranslateModule } from "./modules/translate/translate.module";

import { PdfModule } from "./modules/pdf/pdf.module";
import { KantanModule } from "./modules/kantan/kantan.module";


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // biến môi trường có thể dùng toàn cục
    }),
    MongooseModule.forRoot(process.env.MONGO_URI as string),
    UsersModule,
    ProfilesModule,
    TrophiesModule,
    UserTrophiesModule,
    UserWordsModule,
    SearchHistoryModule,
    UserStreaksModule,
    UserStreakHistoryModule,
    UserNotificationsModule,
    JlptKanjiModule,
    JlptWordModule,
    JlptGrammarModule,
    NotebookModule,
    NotebookItemModule,
    FlashcardModule,
    ExamsModule,
    ExamsPartModule,
    ExamQuestionModule,
    ExamResultsModule,
    ExamResultsDetailModule,
    ExamUserAnswersModule,
    PostsModule,
    PostCategoriesModule,
    CommentsModule,
    ParCommentModule,
    NewsModule,
    NotificationsModule,
    AiChatSessionsModule,
    AuthModule,
    RedisModule,
    UploadModule,
    TextToSpeechModule,
    AiChatSessionsModule,
    ContributionModule,
    UserStudyDayModule,
    StatisticModule,
    TranslateModule,
    PdfModule,
    KantanModule,

    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: "127.0.0.1",
            port: 6379,
          },
        }),
        ttl: 0,
      }),
      isGlobal: true,
    }),
  ],
  providers: [
    // Đăng ký guard toàn cục
    {
      provide: APP_GUARD,
      useClass: AuthGuard, // xác thực JWT
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // phân quyền role
    },
  ],
})
export class AppModule {}
