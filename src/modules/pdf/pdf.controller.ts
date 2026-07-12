import {
  Controller,
  Body,
  Get,
  Post,
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

  @Post("jlpt/custom")
  @Public()
  async downloadCustomJlptPdf(
    @Body() body: {
      type?: "word" | "kanji";
      level?: string;
      items?: { value?: string; traceRows?: number; blankRows?: number }[];
    },
    @Req() req: any,
    @Res() res: Response
  ) {
    const type = body?.type === "kanji" ? "kanji" : "word";
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 50) {
      throw new BadRequestException("PDF must contain between 1 and 50 items");
    }

    try {
      const words = await Promise.all(items.map(async (item) => {
        const value = String(item?.value || "").trim();
        if (!value) throw new Error("Item value is required");

        const traceRows = this.clampRows(item.traceRows, 1);
        const blankRows = this.clampRows(item.blankRows, 1);
        if (type === "word") {
          const word = await this.jlptWordService.getDetailWord(value);
          return {
            word: word.word,
            phonetic: Array.isArray(word.phonetic) ? word.phonetic.join(" ") : word.phonetic || "",
            meanings: Array.isArray(word.meanings)
              ? word.meanings.map((meaning) => typeof meaning === "string" ? meaning : meaning?.meaning).filter(Boolean).join(", ")
              : word.meanings || "",
            traceRows,
            blankRows,
          };
        }

        const kanji = await this.jlptKanjiService.getDetailKanji(value);
        return {
          word: kanji.kanji,
          phonetic: [kanji.kun, kanji.on].filter(Boolean).join(" "),
          meanings: kanji.mean || "",
          traceRows,
          blankRows,
        };
      }));

      const pdfBuffer = await this.pdfService.generateJlptPdfFromWords(words);
      if (req.user?.sub && type === "kanji") {
        await this.learningPathService.recordResourceProgress(req.user.sub, "writing", {
          level: body.level,
          refKey: `pdf:kanji:${body.level || "all"}:custom`,
          metadata: { type, itemCount: items.length },
        });
      }

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="jlpt_${type}_custom.pdf"`,
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

  private clampRows(value: number | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(10, Math.max(0, Math.floor(parsed))) : fallback;
  }
}
