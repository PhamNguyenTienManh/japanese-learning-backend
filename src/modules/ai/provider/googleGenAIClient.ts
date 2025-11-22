// google-genai.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class GoogleGenAIClient {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly logger = new Logger(GoogleGenAIClient.name);

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('[AI] No Gemini API key found in GOOGLE_GEMINI_API_KEY');
    }

    const modelName = 'gemini-2.5-flash-lite';
    const temperature = 0.2;
    const maxRetries = 4;

    this.model = new ChatGoogleGenerativeAI({
      model: modelName,
      temperature,
      apiKey,
      maxRetries,
    });
  }

  public getModel(): ChatGoogleGenerativeAI {
    return this.model;
  }

  async generate(text: string): Promise<string> {
    const res = await this.model.invoke([{ role: 'user', content: text }]);

    try {
      // Nếu response có output array
      // @ts-expect-error - LangChain response structure varies
      if (res?.output && Array.isArray(res.output) && res.output.length) {
        // @ts-expect-error
        return res.output[0].content ?? String(res);
      }

      // Nếu response là plain string hoặc có text/content
      return res?.text ?? res?.content ?? String(res);
    } catch (err) {
      this.logger.error('Error parsing AI response', err);
      return String(res);
    }
  }
}
