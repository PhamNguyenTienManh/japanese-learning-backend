import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ExamResultsService } from './exam_results.service';
import { ExamResult } from './schemas/exam_results.schema';

@Controller('exam-results')
export class ExamResultsController {
  constructor(private readonly examResultsService: ExamResultsService) {}

  // Bắt đầu làm bài
  @Post('start')
  async startExam(@Body() body: { examId: string}, @Req() req: any): Promise<ExamResult> {
    const userId = req.user.sub; 
    return this.examResultsService.startExam(body.examId, userId);
  }

  // Nộp bài, tính điểm
  @Post('submit')
  async submitExam(
    @Body() body: { examResultId: string}, @Req() req: any): Promise<ExamResult> {
      const userId = req.user.sub; 
      return this.examResultsService.submitExam(body.examResultId, userId);
  }

  // Xem kết quả chi tiết
  @Get(':id')
  async getExamResult(@Param('id') examId: string, @Req() req: any) {
    const userId = req.user.sub; 
    return this.examResultsService.getResultDetailByExam(examId, userId);
  }


  @Get('resume/:examResultId')
  async resume(@Param('examResultId') examResultId: string, @Req() req: any ) {
    const userId = req.user.sub; 
    return this.examResultsService.resumeExam(examResultId, userId);
  }

  @Get('status/:examId')
  async checkStatus(
    @Param('examId') examId: string,
    @Req() req: any
  ) {
    const userId = req.user.sub; // Lấy userId từ JWT
    return this.examResultsService.checkExamStatus(examId, userId);
  }

  @Get('comparison/:examId')
  async getComparison(
    @Param('examId') examId: string,
    @Req() req: any
  ) {
    const userId = req.user.sub;
    return this.examResultsService.getExamComparison(examId, userId);
  }

  // Lưu tiến trình bài thi (elapsed time + cập nhật status → SAVING)
  @Patch('save-progress')
  async saveProgress(
    @Body() body: { examResultId: string; elapsed: number },
    @Req() req: any,
  ) {
    const userId = req.user.sub;
    return this.examResultsService.saveProgress(body.examResultId, userId, body.elapsed);
  }
}
