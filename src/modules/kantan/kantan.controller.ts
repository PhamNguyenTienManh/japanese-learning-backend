// src/kantan/kantan.controller.ts

import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { KantanService } from './kantan.service';
import { KanjiSearchDto, KanjiResponseDto } from './dto/kanji-search.dto';
import { Public } from '../auth/public.decorator';

@Controller('kantan')
export class KantanController {
    constructor(private readonly kantanService: KantanService) { }
    @Public()
    @Post('search-kanji')
    async searchKanji(@Body() searchDto: KanjiSearchDto): Promise<KanjiResponseDto> {
        return this.kantanService.searchKanji(searchDto);
    }
    @Public()
    @Get('search-kanji')
    async searchKanjiGet(@Query() query: KanjiSearchDto): Promise<KanjiResponseDto> {
        return this.kantanService.searchKanji(query);
    }
}