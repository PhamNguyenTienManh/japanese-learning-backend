// google-genai.provider.ts
import { Injectable, Logger } from "@nestjs/common";
import { ChatVertexAI } from "@langchain/google-vertexai";
import * as dotenv from "dotenv";

dotenv.config();

@Injectable()
export class GoogleGenAIClient {
  private readonly model: ChatVertexAI;
  private readonly logger = new Logger(GoogleGenAIClient.name);

  constructor() {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!project) {
      this.logger.warn("[AI] Missing GOOGLE_CLOUD_PROJECT env var");
    }
    if (!credentials) {
      this.logger.warn(
        "[AI] Missing GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON)",
      );
    }

    const modelName = "gemini-2.5-flash";
    const temperature = 0.2;
    const maxRetries = 4;

    this.model = new ChatVertexAI({
      model: modelName,
      temperature,
      maxRetries,
      streaming: false,
      location,
    });
  }

  public getModel(): ChatVertexAI {
    return this.model;
  }

  async generate(text: string): Promise<string> {
    const res = await this.model.invoke([{ role: "user", content: text }]);

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
      this.logger.error("Error parsing AI response", err);
      return String(res);
    }
  }
}
