// google-genai.provider.ts
import { Injectable, Logger } from "@nestjs/common";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { VertexAI } from "@google-cloud/vertexai";
import type {
  CachedContent,
  Content,
  GenerativeModelPreview,
} from "@google-cloud/vertexai";
import * as dotenv from "dotenv";
import { configureGoogleApplicationCredentials } from "../../../config/google-credentials";

dotenv.config();
configureGoogleApplicationCredentials();

@Injectable()
export class GoogleGenAIClient {
  private readonly model: ChatVertexAI;
  private readonly vertexAI: VertexAI;
  private readonly modelName = "gemini-2.5-flash";
  private cachedSystemPrompt?: {
    key: string;
    content: CachedContent;
    expiresAt: number;
  };
  private cachedSystemPromptCreatePromise?: Promise<CachedContent | null>;
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
        "[AI] Missing Google credentials env var (set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS_BASE64 on Railway)",
      );
    }

    const temperature = 0.2;
    const maxRetries = 4;

    this.vertexAI = new VertexAI({
      project,
      location,
    });

    this.model = new ChatVertexAI({
      model: this.modelName,
      temperature,
      maxRetries,
      streaming: true,
      authOptions: project ? { projectId: project } : undefined,
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

  public async *streamCachedChat(input: {
    systemPrompt: string;
    history: Array<{ role: "user" | "ai"; content: string }>;
    userMessage: string;
  }): AsyncGenerator<string, void, void> {
    const model = await this.getCachedSystemPromptModel(input.systemPrompt);
    const contents = this.toVertexContents(input.history, input.userMessage);
    const streamResult = await model.generateContentStream({ contents });

    for await (const chunk of streamResult.stream) {
      const text = this.extractVertexResponseText(chunk);
      if (text) yield text;
    }
  }

  public async generateCachedChat(input: {
    systemPrompt: string;
    history: Array<{ role: "user" | "ai"; content: string }>;
    userMessage: string;
  }): Promise<string> {
    const model = await this.getCachedSystemPromptModel(input.systemPrompt);
    const contents = this.toVertexContents(input.history, input.userMessage);
    const result = await model.generateContent({ contents });
    return this.extractVertexResponseText(await result.response);
  }

  private async getCachedSystemPromptModel(
    systemPrompt: string,
  ): Promise<GenerativeModelPreview> {
    const cachedContent = await this.getOrCreateSystemPromptCache(systemPrompt);

    if (cachedContent?.name && cachedContent?.model) {
      return this.vertexAI.preview.getGenerativeModelFromCachedContent(
        cachedContent,
        {
          model: this.modelName,
          generationConfig: {
            temperature: 0.2,
          },
        },
      );
    }

    return this.vertexAI.preview.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.2,
      },
    });
  }

  private async getOrCreateSystemPromptCache(
    systemPrompt: string,
  ): Promise<CachedContent | null> {
    if (process.env.AI_PROMPT_CACHE_ENABLED === "false") return null;

    const now = Date.now();
    const key = this.hashPrompt(systemPrompt);
    if (
      this.cachedSystemPrompt?.key === key &&
      this.cachedSystemPrompt.expiresAt > now
    ) {
      return this.cachedSystemPrompt.content;
    }

    if (this.cachedSystemPromptCreatePromise) {
      return this.cachedSystemPromptCreatePromise;
    }

    this.cachedSystemPromptCreatePromise = this.createSystemPromptCache(
      systemPrompt,
      key,
    ).finally(() => {
      this.cachedSystemPromptCreatePromise = undefined;
    });

    return this.cachedSystemPromptCreatePromise;
  }

  private async createSystemPromptCache(systemPrompt: string, key: string) {
    try {
      const ttlSeconds = Number(process.env.AI_PROMPT_CACHE_TTL_SECONDS || 3600);
      const cachedContent = await this.vertexAI.preview.cachedContents.create({
        displayName: `javi-ai-chat-system-${key.slice(0, 12)}`,
        model: this.modelName,
        systemInstruction: systemPrompt,
        ttl: `${Math.max(ttlSeconds, 60)}s`,
      });

      this.cachedSystemPrompt = {
        key,
        content: cachedContent,
        expiresAt: Date.now() + Math.max(ttlSeconds - 30, 30) * 1000,
      };

      this.logger.log(
        `[AI] Created Vertex cached content for system prompt: ${cachedContent.name}`,
      );

      return cachedContent;
    } catch (error: any) {
      this.logger.warn(
        `[AI] Prompt cache unavailable, falling back without cache: ${error?.message || error}`,
      );
      return null;
    }
  }

  private toVertexContents(
    history: Array<{ role: "user" | "ai"; content: string }>,
    userMessage: string,
  ): Content[] {
    return [
      ...history
        .filter((message) => message?.content)
        .map((message) => ({
          role: message.role === "user" ? "user" : "model",
          parts: [{ text: message.content }],
        })),
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ];
  }

  private extractVertexResponseText(response: any): string {
    return (
      response?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || "")
        .join("") || ""
    );
  }

  private hashPrompt(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
}
