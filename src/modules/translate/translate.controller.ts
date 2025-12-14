import { Controller, Post, Body } from "@nestjs/common";
import { TranslateService } from "./translate.service";
import { Public } from "../auth/public.decorator";
@Controller("translate")
@Public()
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  async translate(@Body() body: any) {
    const { text, source, target } = body;
    const translatedText = await this.translateService.translate(
      text,
      source,
      target
    );

    return { translatedText };
  }
}
