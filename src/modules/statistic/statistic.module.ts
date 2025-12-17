import { Module, Post } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  UserStreakHistory,
  UserStreakHistorySchema,
} from "../user_streak_history/schemas/user_streak_history.schema";
import {
  UserStudyDay,
  UserStudyDaySchema,
} from "../user_study_day/schemas/user_study_day.schema";
import { StatisticService } from "./statistic.service";
import { StatisticController } from "./statistic.controller";
import {
  ExamResult,
  ExamResultSchema,
} from "../exam_results/schemas/exam_results.schema";
import { Profile, ProfileSchema } from "../profiles/schemas/profiles.schema";
import { Exam, ExamSchema } from "../exams/schemas/exams.schema";
import { News, NewsSchema } from "../news/schemas/news.schema";
import {
  JlptKanji,
  JlptKanjiSchema,
} from "../jlpt_kanji/schemas/jlpt_kanji.schema";
import {
  JlptWord,
  JlptWordSchema,
} from "../jlpt_word/schemas/jlpt_word.schema";
import {
  JlptGrammar,
  JlptGrammarSchema,
} from "../jlpt_grammar/schemas/jlpt_grammar.schema";
import { Posts, PostSchema } from "../posts/schemas/posts.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStreakHistory.name, schema: UserStreakHistorySchema },
      { name: UserStudyDay.name, schema: UserStudyDaySchema },
      { name: ExamResult.name, schema: ExamResultSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: News.name, schema: NewsSchema },
      { name: JlptKanji.name, schema: JlptKanjiSchema },
      { name: JlptWord.name, schema: JlptWordSchema },
      { name: JlptGrammar.name, schema: JlptGrammarSchema },
      { name: Posts.name, schema: PostSchema },
    ]),
  ],
  providers: [StatisticService],
  controllers: [StatisticController],
})
export class StatisticModule {}
