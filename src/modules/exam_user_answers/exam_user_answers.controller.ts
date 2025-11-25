import { Controller, Post, Body, Req } from '@nestjs/common';
import { ExamUserAnswersService } from './exam_user_answers.service';
import { ExamUserAnswer } from './schemas/exam_user_answers.schema';
import { SaveAnswersDto } from './dto/answer.dto';


@Controller('exam-user-answers')
export class ExamUserAnswersController {
  constructor(private readonly examUserAnswerService: ExamUserAnswersService) {}

  @Post()
  async saveAnswers(
    @Body() body: SaveAnswersDto,
    @Req() req: any
  ): Promise<ExamUserAnswer> {
    const userId = req.user.sub; 
    return this.examUserAnswerService.SaveAnswers(body, userId);
  }
}