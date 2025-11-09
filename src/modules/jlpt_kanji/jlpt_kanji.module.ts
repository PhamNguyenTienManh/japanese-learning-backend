import { Module } from '@nestjs/common';
import { JlptKanjiService } from './jlpt_kanji.service';
import { JlptKanjiController } from './jlpt_kanji.controller';

@Module({
  providers: [JlptKanjiService],
  controllers: [JlptKanjiController]
})
export class JlptKanjiModule {}
