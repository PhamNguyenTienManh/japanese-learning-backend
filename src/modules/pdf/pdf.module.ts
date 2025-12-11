import { Module } from "@nestjs/common";
import { PdfService } from "./pdf.service";
import { PdfController } from "./pdf.controller";
import { JlptWordModule } from "../jlpt_word/jlpt_word.module";
import { JlptKanjiModule } from "../jlpt_kanji/jlpt_kanji.module";

@Module({
  imports: [JlptWordModule, JlptKanjiModule],
  providers: [PdfService],
  controllers: [PdfController],
})
export class PdfModule {}
