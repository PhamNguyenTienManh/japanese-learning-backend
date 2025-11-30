// exam-question.controller.ts
import { Controller, Post, Get, Param, Body, Put, Delete, Patch} from '@nestjs/common';
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

  @Public()  
  @Patch('update/:questionId')
  async updateExamQuestion(
    @Param('questionId') questionId: string,
    @Body() dto: Partial<CreateExamQuestionDto>,
  ) {
    return await this.examQuestionService.updateExamQuestion(questionId, dto);
  }

  @Public()
  @Delete(':questionId')
  async deleteExamQuestion(@Param('questionId') questionId: string) {
    return await this.examQuestionService.deleteExamQuestion(questionId);
  }

}
