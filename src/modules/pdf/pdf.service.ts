import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs-extra";
import * as Handlebars from "handlebars";
import * as path from "path";
import * as puppeteer from "puppeteer";

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private templatesCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor() { }

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

    const candidates = [
      path.join(process.cwd(), "assets", "kanjivg", `${hex}.svg`),
      path.join(process.cwd(), "assets", "kanjivg", `${hex.toUpperCase()}.svg`),
    ];

    for (const p of candidates) {
      if (await fs.pathExists(p)) {
        let svg = await fs.readFile(p, "utf8");
        svg = svg.replace(/<\?xml.*?\?>\s*/g, "");
        return svg;
      }
    }

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
      const maxSteps = paths.length;

      for (let i = 0; i < maxSteps; i++) {
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
      this.logger.warn(`Failed to parse strokes for ${char}: ${error.message}`);
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
    const enriched = await Promise.all(
      words.map(async (w) => {
        const firstChar = w.word?.[0] || w.word;
        const strokeSvg = await this.loadStrokeSvgForChar(firstChar);
        const strokeSteps = this.parseStrokeSteps(strokeSvg, firstChar);

        const practiceCount = Math.max(1, 20 - strokeSteps.length);
        const practiceBoxes = Array(practiceCount).fill(null);

        return {
          word: w.word,
          firstChar: firstChar,
          phonetic: w.phonetic,
          meanings: w.meanings,
          strokeSteps: strokeSteps,
          practiceBoxes: practiceBoxes,
        };
      })
    );

    const tpl = await this.loadTemplate("jlpt-page");
    if (!tpl) {
      throw new Error("Template jlpt-page not found");
    }

    const html = tpl({ words: enriched });

    const browser = await puppeteer.launch({
      executablePath: puppeteer.executablePath(),
      headless: "new" as any,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });



    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts?.ready);

      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  async generateJlptPdfFromPage(
    jlptService: any,
    page = 1,
    limit = 10,
    level?: string,
    type: "word" | "kanji" = "word"
  ) {
    let result;

    if (type === "word") {
      result = await jlptService.getJlptWordsPaginated(page, limit, level);

      const words = result.data.map((d) => ({
        word: d.word,
        phonetic: d.phonetic,
        meanings: d.meanings,
      }));

      return await this.generateJlptPdfFromWords(words);
    }

    result = await jlptService.getJlptKanjiPaginated(page, limit, level);

    const words = result.data.map((d) => ({
      word: d.kanji,
      phonetic: d.reading,
      meanings: d.mean,
    }));

    return await this.generateJlptPdfFromWords(words);
  }
}
