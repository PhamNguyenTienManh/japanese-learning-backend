import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { PdfService } from "./pdf.service";
import { JlptWordService } from "../jlpt_word/jlpt_word.service";
import { Public } from "../auth/public.decorator";
import { JlptKanjiService } from "../jlpt_kanji/jlpt_kanji.service";

@Controller("pdf")
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly jlptWordService: JlptWordService,
    private readonly jlptKanjiService: JlptKanjiService
  ) {}

  @Get("jlpt")
  @Public()
  async downloadJlptPdf(
    @Query("page") pageStr: string,
    @Query("limit") limitStr: string,
    @Query("level") level: string,
    @Query("type") type: "word" | "kanji" = "word",
    @Res() res: Response
  ) {
    const page = Math.max(1, parseInt(pageStr as any) || 1);
    const limit = Math.max(1, parseInt(limitStr as any) || 9);

    const service =
      type === "word" ? this.jlptWordService : this.jlptKanjiService;

    try {
      const pdfBuffer = await this.pdfService.generateJlptPdfFromPage(
        service,
        page,
        limit,
        level,
        type
      );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="jlpt_${type}_page_${page}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (err) {
      throw new BadRequestException("Failed to generate PDF: " + err.message);
    }
  }
}
