import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JlptKanjiService } from "./jlpt_kanji.service";
import { JlptKanjiController } from "./jlpt_kanji.controller";
import { JlptKanji, JlptKanjiSchema } from "./schemas/jlpt_kanji.schema";
import {
  KanjiStroke,
  KanjiStrokeSchema,
} from "../pdf/schemas/kanji-stroke.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JlptKanji.name, schema: JlptKanjiSchema },
      { name: KanjiStroke.name, schema: KanjiStrokeSchema },
    ]),
  ],
  providers: [JlptKanjiService],
  controllers: [JlptKanjiController],
  exports: [JlptKanjiService],
})
export class JlptKanjiModule {}
