import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

    // exam.controller.ts
    @Public()
    @Get('count-by-level')
    async getCountByLevel() {
        return this.examService.countExamsByLevel();
    }

    @Public()
    @Get('level/:level')
    async getExamsByLevel(@Param('level') level: string) {
        return this.examService.getExamsByLevel(level);
    }

    @Public()
    @Get(':id')
    async getExamDetail(@Param('id') id: string) {
        return this.examService.getExamDetailsGroupedByPart(id);
    }

    @Public()
    @Patch(':id')
    async updateExam(
        @Param('id') id: string,
        @Body() updateExamDto: Partial<CreateExamDto>
    ) {
        return this.examService.updateExam(id, updateExamDto);
    }
}
