import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { ConversationLesson, ConversationLessonSchema } from '../conversation/schemas/conversation-lesson.schema';
import { ExamResult, ExamResultSchema } from '../exam_results/schemas/exam_results.schema';
import { Exam, ExamSchema } from '../exams/schemas/exams.schema';
import { JlptGrammar, JlptGrammarSchema } from '../jlpt_grammar/schemas/jlpt_grammar.schema';
import { JlptKanji, JlptKanjiSchema } from '../jlpt_kanji/schemas/jlpt_kanji.schema';
import { JlptWord, JlptWordSchema } from '../jlpt_word/schemas/jlpt_word.schema';
import { LearningPathController } from './learning-path.controller';
import { LearningPathService } from './learning-path.service';
import { LearningPath, LearningPathSchema } from './schemas/learning-path.schema';
import { JlptCardProgress, JlptCardProgressSchema } from './schemas/jlpt-card-progress.schema';
import {
  LearningResourceProgress,
  LearningResourceProgressSchema,
} from './schemas/learning-resource-progress.schema';
import { PlacementQuestion, PlacementQuestionSchema } from './schemas/placement-question.schema';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: LearningPath.name, schema: LearningPathSchema },
      { name: JlptCardProgress.name, schema: JlptCardProgressSchema },
      { name: LearningResourceProgress.name, schema: LearningResourceProgressSchema },
      { name: PlacementQuestion.name, schema: PlacementQuestionSchema },
      { name: JlptWord.name, schema: JlptWordSchema },
      { name: JlptKanji.name, schema: JlptKanjiSchema },
      { name: JlptGrammar.name, schema: JlptGrammarSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: ExamResult.name, schema: ExamResultSchema },
      { name: ConversationLesson.name, schema: ConversationLessonSchema },
    ]),
  ],
  controllers: [LearningPathController],
  providers: [LearningPathService],
  exports: [LearningPathService],
})
export class LearningPathModule {}
