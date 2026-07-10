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
    @Query("item") item: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const page = Math.max(1, parseInt(pageStr as any) || 1);
    const limit = Math.max(1, parseInt(limitStr as any) || 9);

    const service =
      type === "word" ? this.jlptWordService : this.jlptKanjiService;

    try {
      const targetItem = String(item || "").trim();
      const pdfBuffer = targetItem
        ? await this.generateSingleJlptPdf(targetItem, type)
        : await this.pdfService.generateJlptPdfFromPage(
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
            refKey: targetItem
              ? `pdf:kanji:${level || "all"}:${targetItem}`
              : `pdf:kanji:${level || "all"}:${page}:${limit}`,
            metadata: targetItem
              ? { item: targetItem, type }
              : { page, limit, type },
          }
        );
      }

      const filenameSuffix = targetItem
        ? this.toSafeFilename(targetItem)
        : `page_${page}`;

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="jlpt_${type}_${filenameSuffix}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (err) {
      throw new BadRequestException("Failed to generate PDF: " + err.message);
    }
  }

  private async generateSingleJlptPdf(
    item: string,
    type: "word" | "kanji"
  ) {
    if (type === "word") {
      const word = await this.jlptWordService.getDetailWord(item);
      return this.pdfService.generateJlptPdfFromWords([
        {
          word: word.word,
          phonetic: Array.isArray(word.phonetic)
            ? word.phonetic.join(" ")
            : word.phonetic || "",
          meanings: Array.isArray(word.meanings)
            ? word.meanings
                .map((meaning) =>
                  typeof meaning === "string" ? meaning : meaning?.meaning
                )
                .filter(Boolean)
                .join(", ")
            : word.meanings || "",
        },
      ]);
    }

    const kanji = await this.jlptKanjiService.getDetailKanji(item);
    return this.pdfService.generateJlptPdfFromWords([
      {
        word: kanji.kanji,
        phonetic: [kanji.kun, kanji.on].filter(Boolean).join(" "),
        meanings: kanji.mean || "",
      },
    ]);
  }

  private toSafeFilename(value: string) {
    return encodeURIComponent(value)
      .replace(/%/g, "")
      .slice(0, 60) || "item";
  }
}
