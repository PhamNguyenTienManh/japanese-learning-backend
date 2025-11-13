import { Module } from '@nestjs/common';
import { ExamQuestionService } from './exam_question.service';
import { ExamQuestionController } from './exam_question.controller';
import { ExamQuestion, ExamQuestionSchema } from './schemas/exam_question.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExamQuestion.name, schema: ExamQuestionSchema }]),
  ],
  providers: [ExamQuestionService],
  controllers: [ExamQuestionController]
})
export class ExamQuestionModule {}
