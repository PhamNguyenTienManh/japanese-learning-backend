import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JlptWordSeeder } from './jlpt-word.seed';
import { JlptWordMaziiSeeder } from './jlpt-word-mazii.seed';
import { JlptGrammarSeeder } from './jlpt-grammar.seed';
import { JlptGrammarMaziiSeeder } from './jlpt-grammar-mazii.seed';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptWord, JlptWordSchema } from '../modules/jlpt_word/schemas/jlpt_word.schema';
import { JlptGrammar, JlptGrammarSchema } from '../modules/jlpt_grammar/schemas/jlpt_grammar.schema';
import { JlptKanjiSeeder } from './jlpt-kanji.seed';
import { JlptKanjiMaziiSeeder } from './jlpt-kanji-mazii.seed';
import { JlptKanji, JlptKanjiSchema } from '../modules/jlpt_kanji/schemas/jlpt_kanji.schema';
import { KanjiContributionMaziiSeeder } from './kanji-contribution-mazii.seed';
import { Contribution, ContributionSchema } from '../modules/contribution/schemas/contribution.schema';
import { Profile, ProfileSchema } from '../modules/profiles/schemas/profiles.schema';
import { ExamMaziiSeeder } from './exam-mazii.seed';
import { Exam, ExamSchema } from '../modules/exams/schemas/exams.schema';
import { ExamPart, ExamPartSchema } from '../modules/exams_part/schema/exams_part.schema';
import { ExamQuestion, ExamQuestionSchema } from '../modules/exam_question/schemas/exam_question.schema';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/JAVI',
    ),
    MongooseModule.forFeature([
      { name: JlptWord.name, schema: JlptWordSchema },
      { name: JlptGrammar.name, schema: JlptGrammarSchema },
      { name: JlptKanji.name, schema: JlptKanjiSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: ExamPart.name, schema: ExamPartSchema },
      { name: ExamQuestion.name, schema: ExamQuestionSchema },
    ]),
  ],
  providers: [
    JlptWordSeeder,
    JlptWordMaziiSeeder,
    JlptGrammarSeeder,
    JlptGrammarMaziiSeeder,
    JlptKanjiSeeder,
    JlptKanjiMaziiSeeder,
    KanjiContributionMaziiSeeder,
    ExamMaziiSeeder,
  ],
  exports: [
    JlptWordSeeder,
    JlptWordMaziiSeeder,
    JlptGrammarSeeder,
    JlptGrammarMaziiSeeder,
    JlptKanjiSeeder,
    JlptKanjiMaziiSeeder,
    KanjiContributionMaziiSeeder,
    ExamMaziiSeeder,
  ],
})
export class SeedModule {}
