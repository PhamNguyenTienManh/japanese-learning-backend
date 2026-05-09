import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import * as fs from "fs-extra";
import * as Handlebars from "handlebars";
import * as path from "path";
import * as puppeteer from "puppeteer";

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private templatesCache = new Map<string, Handlebars.TemplateDelegate>();
  private svgCache = new Map<string, string | null>();
  private pdfCache = new Map<string, Uint8Array>();
  private browser!: puppeteer.Browser;
  private fontBase64!: string;

  constructor() {}

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

  private charToHexFileName(char: string): string {
    const code = char.codePointAt(0);
    if (!code) return "";
    return code.toString(16).padStart(5, "0");
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

  private async loadStrokeSvgForChar(char: string) {
    const hex = this.charToHexFileName(char);
    if (!hex) return null;

    // Trả về cache nếu đã load rồi
    if (this.svgCache.has(hex)) return this.svgCache.get(hex);

    const candidates = [
      path.join(process.cwd(), "assets", "kanjivg", `${hex}.svg`),
      path.join(process.cwd(), "assets", "kanjivg", `${hex.toUpperCase()}.svg`),
    ];

    for (const p of candidates) {
      if (await fs.pathExists(p)) {
        let svg = await fs.readFile(p, "utf8");
        svg = svg.replace(/<\?xml.*?\?>\s*/g, "");
        this.svgCache.set(hex, svg);
        return svg;
      }
    }

    this.svgCache.set(hex, null);
    return null;
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

  async generateJlptPdfFromWords(
    words: { word: string; phonetic: string; meanings: string }[]
  ) {
    // Trả cache nếu cùng bộ từ đã generate rồi
    const cacheKey = words.map((w) => w.word).join("|");
    if (this.pdfCache.has(cacheKey)) {
      this.logger.log("PDF cache hit");
      return this.pdfCache.get(cacheKey)!;
    }

    const enriched = await Promise.all(
      words.map(async (w) => {
        const firstChar = w.word?.[0] || w.word;
        const strokeSvg = await this.loadStrokeSvgForChar(firstChar);
        const strokeSteps = this.parseStrokeSteps(strokeSvg, firstChar);
        const practiceCount = Math.max(1, 20 - strokeSteps.length);
        const practiceBoxes = Array(practiceCount).fill(null);

        return {
          word: w.word,
          firstChar,
          phonetic: w.phonetic,
          meanings: w.meanings,
          strokeSteps,
          practiceBoxes,
        };
      })
    );

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
      await page.evaluate(() => document.fonts?.ready);

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