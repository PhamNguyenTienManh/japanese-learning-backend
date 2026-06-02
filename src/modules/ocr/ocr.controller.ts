import { Body, Controller, Logger, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { OcrService } from "./ocr.service";

@Controller("ocr")
@Public()
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post("japanese-handwriting")
  async recognizeJapaneseHandwriting(@Body() body: any) {
    const ink = Array.isArray(body?.ink) ? body.ink : body?.strokes;
    this.logger.log(
      `POST /ocr/japanese-handwriting strokes=${Array.isArray(ink) ? ink.length : 0}`,
    );
    return this.ocrService.recognizeJapaneseHandwriting(body);
  }
}
