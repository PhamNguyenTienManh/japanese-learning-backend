import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import fetch from "node-fetch";

type InkStroke = [number[], number[], number[]];

type JapaneseHandwritingPayload = {
  ink?: InkStroke[];
  strokes?: InkStroke[];
  width?: number;
  height?: number;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly inputToolsUrl =
    "https://inputtools.google.com/request?itc=ja-t-i0-handwrit&app=translate";

  async recognizeJapaneseHandwriting(payload?: JapaneseHandwritingPayload) {
    const ink = this.validateInk(payload?.ink || payload?.strokes);
    const width = this.normalizeDimension(payload?.width, 360);
    const height = this.normalizeDimension(payload?.height, 360);
    const pointCount = ink.reduce((total, stroke) => total + stroke[0].length, 0);

    this.logger.log(
      `Calling Google Input Tools handwriting OCR, strokes=${ink.length}, points=${pointCount}, width=${width}, height=${height}`,
    );

    const response = await fetch(this.inputToolsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_level: "537.36",
        app_version: 0.4,
        device:
          "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        input_type: 0,
        options: "enable_pre_space",
        requests: [
          {
            ink,
            max_completions: 0,
            max_num_results: 10,
            pre_context: "",
            writing_guide: {
              writing_area_width: width,
              writing_area_height: height,
            },
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    this.logger.log(`Google Input Tools response status=${response.status}`);

    if (!response.ok) {
      throw new HttpException("Google Input Tools API failed", response.status);
    }

    if (!Array.isArray(data) || data[0] !== "SUCCESS") {
      this.logger.error(`Unexpected Input Tools response: ${JSON.stringify(data)}`);
      throw new InternalServerErrorException("Google Input Tools API failed");
    }

    const candidates = this.extractJapaneseCandidates(data[1]);
    const text = candidates[0] || "";
    this.logger.log(`Detected handwriting candidates=${candidates.length}`);

    return {
      text,
      candidates,
    };
  }

  private validateInk(ink?: InkStroke[]) {
    if (!Array.isArray(ink) || ink.length === 0) {
      throw new BadRequestException("ink strokes are required");
    }

    const validInk = ink.filter((stroke) => {
      if (!Array.isArray(stroke) || stroke.length !== 3) return false;
      const [xs, ys, ts] = stroke;
      return (
        Array.isArray(xs) &&
        Array.isArray(ys) &&
        Array.isArray(ts) &&
        xs.length > 0 &&
        xs.length === ys.length &&
        xs.length === ts.length &&
        xs.every((point) => Number.isFinite(Number(point))) &&
        ys.every((point) => Number.isFinite(Number(point))) &&
        ts.every((point) => Number.isFinite(Number(point)))
      );
    });

    if (!validInk.length) {
      throw new BadRequestException("ink is invalid");
    }

    return validInk.map(([xs, ys, ts]) => [
      xs.map((point) => Math.round(Number(point))),
      ys.map((point) => Math.round(Number(point))),
      ts.map((point) => Math.max(0, Math.round(Number(point)))),
    ]) as InkStroke[];
  }

  private normalizeDimension(value: unknown, fallback: number) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;
    return Math.round(numberValue);
  }

  private extractJapaneseCandidates(value: unknown) {
    const candidates: string[] = [];
    const visit = (node: unknown) => {
      if (typeof node === "string") {
        const text = node.trim();
        if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) {
          candidates.push(text);
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach(visit);
      }
    };

    visit(value);
    return Array.from(new Set(candidates)).slice(0, 10);
  }
}
