import { Module } from '@nestjs/common';
import { ExamResultsService } from './exam_results.service';
import { ExamResultsController } from './exam_results.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamResult, ExamResultSchema } from './schemas/exam_results.schema';
import { ExamPart, ExamPartSchema } from '../exams_part/schema/exams_part.schema';
import { ExamUserAnswer, ExamUserAnswerSchema } from '../exam_user_answers/schemas/exam_user_answers.schema';
import { Exam, ExamSchema } from '../exams/schemas/exams.schema';
import { ExamResultDetail, ExamResultDetailSchema } from '../exam_results_detail/schemas/exam_results_detail.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExamResult.name, schema: ExamResultSchema }]),
    MongooseModule.forFeature([{ name: ExamPart.name, schema: ExamPartSchema }]),
    MongooseModule.forFeature([{ name: ExamUserAnswer.name, schema: ExamUserAnswerSchema }]),
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
    MongooseModule.forFeature([{ name: ExamResultDetail.name, schema: ExamResultDetailSchema }]),
  ],
  providers: [ExamResultsService],
  controllers: [ExamResultsController]
})
export class ExamResultsModule {}
