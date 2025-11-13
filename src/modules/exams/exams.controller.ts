import { Body, Controller, Post } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { Public } from '../auth/public.decorator';
import { CreateExamDto } from './dto/create-exam.dto';

@Controller('exams')
export class ExamsController {
    constructor(private readonly examService: ExamsService) {}

    @Public()
    @Post()
    async createExam(@Body() createExamDto: CreateExamDto) {
        return this.examService.createExam(createExamDto);
    }
}
