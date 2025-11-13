import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JlptWordService } from './jlpt_word.service';
import { CreateJlptWordDto } from './dto/create-jlpt-word.dto';
import { Public } from '../auth/public.decorator';

@Controller('jlpt-word')
export class JlptWordController {
    constructor(private jlptWordService: JlptWordService) {}

    @Public()
    @Post()
    async create(@Body() createData: CreateJlptWordDto){
        return this.jlptWordService.createJlptWord(createData);
    }

    @Public()
    @Get('detail')
    async getDetailWord(@Query('word') word: string) {
    return this.jlptWordService.getDetailWord(word);
    }


    @Public()
    @Get()
    async getJlptWords(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('level') level?: string,
    ) {
        return this.jlptWordService.getJlptWordsPaginated(+page, +limit, level);
    }

}
