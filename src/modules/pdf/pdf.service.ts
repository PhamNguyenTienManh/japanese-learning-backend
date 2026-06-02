import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as fs from "fs-extra";
import * as Handlebars from "handlebars";
import { Model } from "mongoose";
import * as path from "path";
import * as puppeteer from "puppeteer";
import { KanjiStroke } from "./schemas/kanji-stroke.schema";

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private templatesCache = new Map<string, Handlebars.TemplateDelegate>();
  private svgCache = new Map<string, string | null>();
  private pdfCache = new Map<string, Uint8Array>();
  private browser!: puppeteer.Browser;
  private fontBase64!: string;

  constructor(
    @InjectModel(KanjiStroke.name)
    private readonly kanjiStrokeModel: Model<KanjiStroke>
  ) {}

  async onModuleInit() {
    // Khởi động browser 1 lần duy nhất
    this.browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    this.logger.log("Puppeteer browser started");

    // Load font 1 lần, cache lại — không fetch internet mỗi request nữa
    const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSansJP.woff2");
    if (await fs.pathExists(fontPath)) {
      this.fontBase64 = await fs.readFile(fontPath, "base64");
      this.logger.log("Font NotoSansJP loaded from local");
    } else {
      this.logger.warn("Font NotoSansJP not found, will fallback to system font");
      this.fontBase64 = "";
    }
  }

  async onModuleDestroy() {
    await this.browser?.close();
    this.logger.log("Puppeteer browser closed");
  }

  private async loadTemplate(name: string) {
    if (this.templatesCache.has(name)) return this.templatesCache.get(name);
    const file = path.join(
      process.cwd(),
      "src/modules/pdf/templates",
      `${name}.hbs`
    );
    const content = await fs.readFile(file, "utf8");
    const tpl = Handlebars.compile(content);
    this.templatesCache.set(name, tpl);
    return tpl;
  }

  private parseStrokeSteps(svgContent: string | null, char: string): string[] {
    if (!svgContent) {
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109">
          <text x="54.5" y="80" text-anchor="middle" font-size="70" fill="#000">${char}</text>
        </svg>`,
      ];
    }

    try {
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 109 109";

      const pathRegex = /<path[^>]*id="[^"]*-s\d+"[^>]*\/>/g;
      const paths = svgContent.match(pathRegex) || [];

      if (paths.length === 0) {
        return [svgContent];
      }

      const steps: string[] = [];

      for (let i = 0; i < paths.length; i++) {
        const cumulativePaths = paths.slice(0, i + 1).join("\n    ");
        const stepSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    ${cumulativePaths}
  </g>
</svg>`;
        steps.push(stepSvg);
      }

      return steps;
    } catch (error) {
      this.logger.warn(`Failed to parse strokes for ${char}: ${(error as Error).message}`);
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109">
          <text x="54.5" y="80" text-anchor="middle" font-size="70">${char}</text>
        </svg>`,
      ];
    }
  }

  private limitMeaningsForPdf(meanings: string) {
    return String(meanings || "")
      .split(",")
      .map((meaning) => meaning.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
  }

  private limitReadingsForPdf(readings: string) {
    return String(readings || "")
      .split(/[,、\s]+/)
      .map((reading) => reading.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
  }

  async generateJlptPdfFromWords(
    words: { word: string; phonetic: string; meanings: string }[]
  ) {
    // Trả cache nếu cùng bộ từ đã generate rồi
    const cacheKey = words.map((w) => w.word).join("|");
    if (this.pdfCache.has(cacheKey)) {
      this.logger.log("PDF cache hit");
      return this.pdfCache.get(cacheKey)!;
    }

    const firstChars = words.map((w) => w.word?.[0] || w.word);
    const charsToLoad = Array.from(
      new Set(firstChars.filter((char) => char && !this.svgCache.has(char)))
    );

    if (charsToLoad.length) {
      const strokes = await this.kanjiStrokeModel
        .find({ char: { $in: charsToLoad } }, { char: 1, svgContent: 1 })
        .lean();
      const strokeMap = new Map(
        strokes.map((stroke) => [stroke.char, stroke.svgContent ?? null])
      );

      for (const char of charsToLoad) {
        this.svgCache.set(char, strokeMap.get(char) ?? null);
      }
    }

    const enriched = words.map((w, index) => {
      const firstChar = firstChars[index];
      const strokeSvg = firstChar ? this.svgCache.get(firstChar) ?? null : null;
      const strokeSteps = this.parseStrokeSteps(strokeSvg, firstChar);
      const practiceCount = Math.max(1, 20 - strokeSteps.length);
      const practiceBoxes = Array(practiceCount).fill(null);

      return {
        word: w.word,
        firstChar,
        phonetic: this.limitReadingsForPdf(w.phonetic),
        meanings: this.limitMeaningsForPdf(w.meanings),
        strokeSteps,
        practiceBoxes,
      };
    });

    const tpl = await this.loadTemplate("jlpt-page");
    if (!tpl) {
      throw new Error("Template jlpt-page not found");
    }

    const html = tpl({ words: enriched, fontBase64: this.fontBase64 });

    // Dùng lại browser đã khởi động sẵn, không launch mới
    const page = await this.browser.newPage();

    try {
      // domcontentloaded thay networkidle0 — đủ dùng vì HTML đã inline SVG + font sẵn
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready.then(() => true));

      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      });

      // Lưu cache
      this.pdfCache.set(cacheKey, pdfBuffer);

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  async generateJlptPdfFromPage(
    jlptService: any,
    page = 1,
    limit = 10,
    level?: string,
    type: "word" | "kanji" = "word"
  ) {
    if (type === "word") {
      const result = await jlptService.getJlptWordsPaginated(page, limit, level);
      const words = result.data.map((d) => ({
        word: d.word,
        phonetic: d.phonetic,
        meanings: d.meanings,
      }));
      return await this.generateJlptPdfFromWords(words);
    }

    const result = await jlptService.getJlptKanjiPaginated(page, limit, level);
    const words = result.data.map((d) => ({
      word: d.kanji,
      phonetic: d.reading,
      meanings: d.mean,
    }));
    return await this.generateJlptPdfFromWords(words);
  }
}
