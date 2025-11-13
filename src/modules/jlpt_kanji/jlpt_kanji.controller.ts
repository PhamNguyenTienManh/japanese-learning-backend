import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { JlptKanjiService } from './jlpt_kanji.service';
import { Public } from '../auth/public.decorator';
import { CreateJlptKanjiDto } from './dto/create-jlpt-kanji.dto';

@Controller('jlpt-kanji')
export class JlptKanjiController {
    constructor(private jlptKanjiService: JlptKanjiService) {}
    
    @Public()
    @Post()
    async create(@Body() createData: CreateJlptKanjiDto){
        return this.jlptKanjiService.createJlptKanji(createData);
    }

    @Public()
    @Get('detail')
    async getDetailWord(@Query('word') kanji: string) {
        return this.jlptKanjiService.getDetailKanji(kanji);
    }
    
    
    @Public()
    @Get()
    async getJlptWords(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('level') level?: string,
    ) {
        return this.jlptKanjiService.getJlptKanjiPaginated(+page, +limit, level);
    }
}
