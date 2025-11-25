import { Module } from '@nestjs/common';
import { ExamUserAnswersService } from './exam_user_answers.service';
import { ExamUserAnswersController } from './exam_user_answers.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamUserAnswer, ExamUserAnswerSchema } from './schemas/exam_user_answers.schema';
import { ExamQuestion, ExamQuestionSchema } from '../exam_question/schemas/exam_question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExamUserAnswer.name, schema: ExamUserAnswerSchema }]),
    MongooseModule.forFeature([{ name: ExamQuestion.name, schema: ExamQuestionSchema }]),
  ],
  providers: [ExamUserAnswersService],
  controllers: [ExamUserAnswersController]
})
export class ExamUserAnswersModule {}
