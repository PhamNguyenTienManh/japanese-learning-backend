import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PdfService } from "./pdf.service";
import { PdfController } from "./pdf.controller";
import { JlptWordModule } from "../jlpt_word/jlpt_word.module";
import { JlptKanjiModule } from "../jlpt_kanji/jlpt_kanji.module";
import { KanjiStroke, KanjiStrokeSchema } from "./schemas/kanji-stroke.schema";
import { LearningPathModule } from "../learning-path/learning-path.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KanjiStroke.name, schema: KanjiStrokeSchema },
    ]),
    JlptWordModule,
    JlptKanjiModule,
    LearningPathModule,
  ],
  providers: [PdfService],
  controllers: [PdfController],
})
export class PdfModule {}
