import { Module } from '@nestjs/common';
import { ExamUserAnswersService } from './exam_user_answers.service';
import { ExamUserAnswersController } from './exam_user_answers.controller';

@Module({
  providers: [ExamUserAnswersService],
  controllers: [ExamUserAnswersController]
})
export class ExamUserAnswersModule {}
