// exam-question.controller.ts
import { Controller, Post, Get, Param, Body} from '@nestjs/common';
import { CreateExamQuestionDto } from './dto/create-exam-question.dto';
import { ExamQuestionService } from './exam_question.service';
import { Public } from '../auth/public.decorator';

@Controller('exam-questions')
export class ExamQuestionController {
  constructor(private readonly examQuestionService: ExamQuestionService) {}

  // Tạo câu hỏi mới cho 1 phần thi
  @Public()
  @Post(':partId')
  async createQuestion(
    @Param('partId') partId: string,
    @Body() createExamQuestionDto: CreateExamQuestionDto) {
    return this.examQuestionService.createExamQuestion(partId, createExamQuestionDto);
  }

}
