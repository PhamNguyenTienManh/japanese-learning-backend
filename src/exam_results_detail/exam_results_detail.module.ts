import { Module } from '@nestjs/common';
import { ExamResultsDetailService } from './exam_results_detail.service';
import { ExamResultsDetailController } from './exam_results_detail.controller';

@Module({
  providers: [ExamResultsDetailService],
  controllers: [ExamResultsDetailController]
})
export class ExamResultsDetailModule {}
