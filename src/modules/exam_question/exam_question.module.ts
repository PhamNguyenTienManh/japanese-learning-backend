import { Module } from '@nestjs/common';
import { ExamQuestionService } from './exam_question.service';
import { ExamQuestionController } from './exam_question.controller';

@Module({
  providers: [ExamQuestionService],
  controllers: [ExamQuestionController]
})
export class ExamQuestionModule {}
