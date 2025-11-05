import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TrophiesModule } from './trophies/trophies.module';
import { UserTrophiesModule } from './user_trophies/user_trophies.module';
import { UserWordsModule } from './user_words/user_words.module';
import { SearchHistoryModule } from './search_history/search_history.module';
import { UserStreaksModule } from './user_streaks/user_streaks.module';
import { UserStreakHistoryModule } from './user_streak_history/user_streak_history.module';
import { UserNotificationsModule } from './user_notifications/user_notifications.module';
import { JlptKanjiModule } from './jlpt_kanji/jlpt_kanji.module';
import { JlptWordModule } from './jlpt_word/jlpt_word.module';
import { JlptGrammarModule } from './jlpt_grammar/jlpt_grammar.module';
import { NotebookModule } from './notebook/notebook.module';
import { NotebookItemModule } from './notebook-item/notebook-item.module';
import { FlashcardModule } from './flashcard/flashcard.module';
import { ExamsModule } from './exams/exams.module';
import { ExamsPartModule } from './exams_part/exams_part.module';
import { ExamQuestionModule } from './exam_question/exam_question.module';
import { ExamResultsModule } from './exam_results/exam_results.module';
import { ExamResultsDetailModule } from './exam_results_detail/exam_results_detail.module';
import { ExamUserAnswersModule } from './exam_user_answers/exam_user_answers.module';
import { PostsModule } from './posts/posts.module';
import { PostCategoriesModule } from './post_categories/post_categories.module';
import { CommentsModule } from './comments/comments.module';
import { ParCommentModule } from './par_comment/par_comment.module';
import { NewsModule } from './news/news.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiChatSessionsModule } from './ai_chat_sessions/ai_chat_sessions.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/JAVI'), // thay bằng URI của bạn
    UsersModule, ProfilesModule, TrophiesModule, UserTrophiesModule, UserWordsModule, SearchHistoryModule, UserStreaksModule, UserStreakHistoryModule, UserNotificationsModule, JlptKanjiModule, JlptWordModule, JlptGrammarModule, NotebookModule, NotebookItemModule, FlashcardModule, ExamsModule, ExamsPartModule, ExamQuestionModule, ExamResultsModule, ExamResultsDetailModule, ExamUserAnswersModule, PostsModule, PostCategoriesModule, CommentsModule, ParCommentModule, NewsModule, NotificationsModule, AiChatSessionsModule,
  ],
})
export class AppModule {}
