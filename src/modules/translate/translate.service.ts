import { Injectable, InternalServerErrorException } from "@nestjs/common";
import fetch from "node-fetch";

interface GoogleTranslateResponse {
  data: {
    translations: {
      translatedText: string;
      detectedSourceLanguage?: string;
    }[];
  };
}

@Injectable()
export class TranslateService {
  async translate(text: string, source: string, target: string) {
    const url = new URL(
      "https://translation.googleapis.com/language/translate/v2"
    );

    url.searchParams.append("q", text);
    url.searchParams.append("source", source);
    url.searchParams.append("target", target);
    url.searchParams.append("key", process.env.GOOGLE_TRANSLATE_KEY as string);

    const res = await fetch(url.toString(), { method: "POST" });

    if (!res.ok) {
      throw new InternalServerErrorException("Google Translate API failed");
    }

    const data = (await res.json()) as GoogleTranslateResponse;

    return data.data.translations[0].translatedText;
  }
}
