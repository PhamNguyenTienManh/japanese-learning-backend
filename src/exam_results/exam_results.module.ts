import { Module } from '@nestjs/common';
import { ExamResultsService } from './exam_results.service';
import { ExamResultsController } from './exam_results.controller';

@Module({
  providers: [ExamResultsService],
  controllers: [ExamResultsController]
})
export class ExamResultsModule {}
