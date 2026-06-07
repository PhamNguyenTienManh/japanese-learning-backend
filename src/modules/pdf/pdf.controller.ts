import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { PdfService } from "./pdf.service";
import { JlptWordService } from "../jlpt_word/jlpt_word.service";
import { Public } from "../auth/public.decorator";
import { JlptKanjiService } from "../jlpt_kanji/jlpt_kanji.service";
import { LearningPathService } from "../learning-path/learning-path.service";

@Controller("pdf")
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly jlptWordService: JlptWordService,
    private readonly jlptKanjiService: JlptKanjiService,
    private readonly learningPathService: LearningPathService
  ) {}

  @Get("jlpt")
  @Public()
  async downloadJlptPdf(
    @Query("page") pageStr: string,
    @Query("limit") limitStr: string,
    @Query("level") level: string,
    @Query("type") type: "word" | "kanji" = "word",
    @Req() req: any,
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

      if (req.user?.sub && type === "kanji") {
        await this.learningPathService.recordResourceProgress(
          req.user.sub,
          "writing",
          {
            level,
            refKey: `pdf:kanji:${level || "all"}:${page}:${limit}`,
            metadata: { page, limit, type },
          }
        );
      }

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
