import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptKanjiService } from './jlpt_kanji.service';
import { JlptKanjiController } from './jlpt_kanji.controller';
import { JlptKanji, JlptKanjiSchema } from './schemas/jlpt_kanji.schema';

@Module({
  imports: [
        MongooseModule.forFeature([{ name: JlptKanji.name, schema: JlptKanjiSchema }])
  ],
  providers: [JlptKanjiService],
  controllers: [JlptKanjiController]
})
export class JlptKanjiModule {}
