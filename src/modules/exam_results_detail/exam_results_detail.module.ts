import { Module } from '@nestjs/common';
import { ExamResultsDetailService } from './exam_results_detail.service';
import { ExamResultsDetailController } from './exam_results_detail.controller';
import { ExamResultDetail, ExamResultDetailSchema } from './schemas/exam_results_detail.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
      MongooseModule.forFeature([{ name: ExamResultDetail.name, schema: ExamResultDetailSchema }]),
    ],
  providers: [ExamResultsDetailService],
  controllers: [ExamResultsDetailController]
})
export class ExamResultsDetailModule {}
