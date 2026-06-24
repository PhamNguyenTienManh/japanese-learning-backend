import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { KanaService } from './kana.service';
import type { KanaSyllabary } from './data/kana-characters.data';

@Controller('kana')
export class KanaController {
  constructor(private readonly kanaService: KanaService) {}

  @Public()
  @Get('groups')
  getGroups(@Query('syllabary') syllabary: KanaSyllabary) {
    return this.kanaService.getGroups(syllabary);
  }

  @Public()
  @Get('combinations')
  getCombinations(@Query('syllabary') syllabary: KanaSyllabary) {
    return this.kanaService.getCombinations(syllabary);
  }

  @Public()
  @Get('basics')
  getBasics() {
    return this.kanaService.getBasics();
  }
}
