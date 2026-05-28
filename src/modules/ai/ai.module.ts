import { Module } from "@nestjs/common";
import { NotebookModule } from "../notebook/notebook.module";
import { NotebookItemModule } from "../notebook-item/notebook-item.module";
import { GeminiProvider } from "./provider/gemini.provider";
import { ChatAgent } from "./agent/chat.agent";
import { NotebookAgent } from "./agent/notebook.agent";
import { GoogleGenAIClient } from "./provider/googleGenAIClient";
import { NotebookAIService } from "./service/notebook-ai.service";
import { AiLangfuseTracingService } from "./service/ai-langfuse-tracing.service";

@Module({
  imports: [NotebookModule, NotebookItemModule],
  providers: [
    ChatAgent,
    GeminiProvider,
    GoogleGenAIClient,
    NotebookAgent,
    NotebookAIService,
    AiLangfuseTracingService,
  ],
  exports: [
    GeminiProvider,
    ChatAgent,
    GoogleGenAIClient,
    AiLangfuseTracingService,
  ],
})
export class AiModule {}
