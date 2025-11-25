import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './schemas/exams.schema';
import { ExamPart, ExamPartSchema } from '../exams_part/schema/exams_part.schema';
import { ExamQuestion, ExamQuestionSchema } from '../exam_question/schemas/exam_question.schema';

@Module({
  imports: [
  MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: ExamPart.name, schema: ExamPartSchema },
      { name: ExamQuestion.name, schema: ExamQuestionSchema },
    ]),
  ],
  providers: [ExamsService],
  controllers: [ExamsController]
})
export class ExamsModule {}
