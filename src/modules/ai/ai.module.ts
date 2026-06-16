import { Module } from "@nestjs/common";
import { NotebookModule } from "../notebook/notebook.module";
import { NotebookItemModule } from "../notebook-item/notebook-item.module";
import { GeminiProvider } from "./provider/gemini.provider";
import { ChatAgent } from "./agent/chat.agent";
import { NotebookAgent } from "./agent/notebook.agent";
import { GoogleGenAIClient } from "./provider/googleGenAIClient";
import { NotebookAIService } from "./service/notebook-ai.service";
import { AiLangfuseTracingService } from "./service/ai-langfuse-tracing.service";
import { AiFastReplyService } from "./service/ai-fast-reply.service";

@Module({
  imports: [NotebookModule, NotebookItemModule],
  providers: [
    ChatAgent,
    GeminiProvider,
    GoogleGenAIClient,
    NotebookAgent,
    NotebookAIService,
    AiLangfuseTracingService,
    AiFastReplyService,
  ],
  exports: [
    GeminiProvider,
    ChatAgent,
    GoogleGenAIClient,
    AiLangfuseTracingService,
    AiFastReplyService,
  ],
})
export class AiModule {}
