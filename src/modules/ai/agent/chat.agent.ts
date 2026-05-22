// chat.agent.ts
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import {
  createNotebookTool,
  searchNotebookByNameTool,
  addNotebookItemsTool,
  createNamedNotebookTool,
  listUserNotebooksTool,
  getNotebookItemsTool,
  addGeneratedNotebookItems,
} from "../tools/notebookTools";
import { NotebookService } from "src/modules/notebook/notebook.service";
import { NotebookItemService } from "src/modules/notebook-item/notebook-item.service";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import {
  InMemoryChatMessageHistory,
  BaseChatMessageHistory,
} from "@langchain/core/chat_history";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GoogleGenAIClient } from "../provider/googleGenAIClient";
import { ToolInterface } from "@langchain/core/tools";
import { NotebookAIService } from "../service/notebook-ai.service";
import { AiLangfuseTracingService } from "../service/ai-langfuse-tracing.service";

export type ChatRole = "user" | "ai";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

@Injectable()
export class ChatAgent {
  private readonly logger = new Logger(ChatAgent.name);

  private histories = new Map<string, BaseChatMessageHistory>();
  private systemPrompt: string;

  constructor(
    private readonly googleGenAIClient: GoogleGenAIClient,
    private readonly notebookAIService: NotebookAIService,
    private readonly notebookService: NotebookService,
    private readonly notebookItemService: NotebookItemService,
    private readonly aiLangfuseTracing: AiLangfuseTracingService,
  ) {
    this.systemPrompt = this.loadSystemPrompt();
  }

  private loadSystemPrompt(): string {
    const path = "src/modules/ai/prompts/system-chat.jp.txt";
    try {
      return fs.readFileSync(path, "utf8");
    } catch {
      return `あなたは優しい日本語学習アシスタントです。`;
    }
  }

  private getHistory(sessionId: string): BaseChatMessageHistory {
    if (!sessionId) {
      this.logger.error("sessionId is missing in getHistory");
      throw new Error("sessionId is required");
    }

    if (this.histories.has(sessionId)) {
      return this.histories.get(sessionId)!;
    }

    const history = new InMemoryChatMessageHistory();
    this.histories.set(sessionId, history);
    return history;
  }

  private async seedHistory(
    sessionId: string,
    messages: ChatMessage[] = [],
  ): Promise<void> {
    const history = this.getHistory(sessionId);

    await history.clear();
    await history.addMessages(
      messages
        .filter((message) => message?.content)
        .map((message) =>
          message.role === "user"
            ? new HumanMessage(message.content)
            : new AIMessage(message.content),
        ),
    );
  }

  /**
   * Build executor wrapper với tools đã bind userId qua closure.
   * Tạo lại mỗi request — rẻ, và tránh được vụ config không propagate
   * trong streamEvents của RunnableWithMessageHistory.
   */
  private buildWithHistory(userId: string) {
    const tools: ToolInterface[] = [
      createNotebookTool(
        this.notebookAIService,
        this.notebookService,
        this.notebookItemService,
        userId,
      ) as unknown as ToolInterface,
      createNamedNotebookTool(
        this.notebookAIService,
        this.notebookService,
        this.notebookItemService,
        userId,
      ) as unknown as ToolInterface,
      searchNotebookByNameTool(
        this.notebookService,
        userId,
      ) as unknown as ToolInterface,
      addNotebookItemsTool(
        this.notebookAIService,
        this.notebookItemService,
      ) as unknown as ToolInterface,
      listUserNotebooksTool(
        this.notebookService,
        this.notebookItemService,
        userId,
      ) as unknown as ToolInterface,
      getNotebookItemsTool(
        this.notebookService,
        this.notebookItemService,
        userId,
      ) as unknown as ToolInterface,
    ];

    const llm = this.googleGenAIClient.getModel();
    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(this.systemPrompt),
      new MessagesPlaceholder("chat_history"),
      new MessagesPlaceholder("input"),
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = createToolCallingAgent({ llm, tools, prompt });
    const executor = new AgentExecutor({
      agent,
      tools,
      maxIterations: 10,
      returnIntermediateSteps: true,
    });

    // Normalize output: Gemini trả array khi có emoji/special chars
    const normalizedExecutor = executor.pipe(
      new RunnableLambda({
        func: (result: any) => {
          let text = result?.output;
          if (Array.isArray(text)) {
            text = text
              .filter(
                (m: any) => m?.type === "text" && typeof m?.text === "string",
              )
              .map((m: any) => m.text)
              .join("");
          } else if (typeof text === "object" && text !== null) {
            text = text.text || text.content || JSON.stringify(text);
          }
          return {
            ...result,
            output: typeof text === "string" ? text : JSON.stringify(text),
          };
        },
      }),
    );

    const withHistory = new RunnableWithMessageHistory({
      runnable: normalizedExecutor,
      getMessageHistory: (sessionId: string) => {
        if (!sessionId || typeof sessionId !== "string") {
          this.logger.error("Invalid sessionId:", sessionId);
          throw new Error("sessionId must be a string");
        }
        return this.getHistory(sessionId);
      },
      inputMessagesKey: "input",
      historyMessagesKey: "chat_history",
      outputMessagesKey: "output",
    });

    return withHistory;
  }

  /**
   * Gửi message tới AI và nhận phản hồi
   */
  public async chatReply(
    messages: ChatMessage[],
    userMessage: string,
    sessionId: string,
    userId: string,
    contextMessages: ChatMessage[] = [],
  ): Promise<string> {
    if (!sessionId) {
      this.logger.error("sessionId is missing");
      throw new Error("sessionId is required");
    }
    if (!userId) {
      this.logger.error("userId is missing");
      throw new Error("userId is required");
    }

    const withHistory = this.buildWithHistory(userId);
    await this.seedHistory(sessionId, contextMessages);

    // Ép userMessage thành string an toàn
    const safeInput =
      typeof userMessage === "string" ? userMessage : String(userMessage);

    const payload = { input: safeInput };

    const config = {
      configurable: {
        sessionId,
      },
      callbacks: this.aiLangfuseTracing.createLangChainCallbacks({
        userId,
        sessionId,
        workflow: "message",
      }),
      metadata: {
        langfuseUserId: userId,
        langfuseSessionId: sessionId,
      },
      runName: "ai-chat-langchain-message",
      tags: ["ai-chat", "message"],
    };

    try {
      const result = await withHistory.invoke(payload, config);

      this.logger.log(`Agent response received`);
      this.logger.debug(`Result type: ${typeof result?.output}`);

      let output = result?.output;

      // Nếu output là mảng object { type, text }, join tất cả text lại
      if (Array.isArray(output)) {
        output = output
          .filter((m: any) => typeof m.text === "string")
          .map((m: any) => m.text)
          .join("\n");
      }
      // Nếu output là object, lấy text hoặc content
      else if (typeof output === "object" && output !== null) {
        output = output.text || output.content || JSON.stringify(output);
      }

      // Trả về string
      const finalOutput =
        typeof output === "string" && output.trim().length > 0
          ? output
          : "Xin lỗi, mình chưa có phản hồi phù hợp";

      return finalOutput;
      // return typeof output === "string" ? output : JSON.stringify(output);
    } catch (err) {
      this.logger.error("[ChatAgent] Failed to generate response");
      
      if (err instanceof Error) {
        this.logger.error("Error:", err.message);
        this.logger.error("Stack:", err.stack);
      } else {
        this.logger.error("Error:", String(err));
      }
      
      throw err;
    }
  }

  /**
   * Stream phản hồi token-by-token và tool result.
   * Yield một trong:
   *   { kind: "token", text }    — text do LLM sinh ra
   *   { kind: "tool",  toolName, output } — kết quả của tool sau khi chạy
   */
  public async *streamReply(
    userMessage: string,
    sessionId: string,
    userId: string,
    contextMessages: ChatMessage[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamReplyEvent, void, void> {
    if (!sessionId) throw new Error("sessionId is required");
    if (!userId) throw new Error("userId is required");

    const withHistory = this.buildWithHistory(userId);
    await this.seedHistory(sessionId, contextMessages);

    const safeInput =
      typeof userMessage === "string" ? userMessage : String(userMessage);
    const payload = { input: safeInput };
    const config = {
      configurable: { sessionId },
      version: "v2" as const,
      signal,
      callbacks: this.aiLangfuseTracing.createLangChainCallbacks({
        userId,
        sessionId,
        workflow: "stream",
      }),
      metadata: {
        langfuseUserId: userId,
        langfuseSessionId: sessionId,
      },
      runName: "ai-chat-langchain-stream",
      tags: ["ai-chat", "stream"],
    };

    const eventStream = withHistory.streamEvents(payload, config);

    for await (const event of eventStream) {
      if (signal?.aborted) return;

      if (event.event === "on_chat_model_stream") {
        const chunk: any = (event as any).data?.chunk;
        const content = chunk?.content;

        let text = "";
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter(
              (c: any) => c?.type === "text" && typeof c?.text === "string",
            )
            .map((c: any) => c.text)
            .join("");
        }

        if (text) yield { kind: "token", text };
      } else if (event.event === "on_tool_end") {
        const toolName = (event as any).name as string;
        const rawOutput = (event as any).data?.output;

        // Tool có thể trả string (JSON.stringify) hoặc ToolMessage có content
        let asText: string | undefined;
        if (typeof rawOutput === "string") {
          asText = rawOutput;
        } else if (rawOutput && typeof rawOutput.content === "string") {
          asText = rawOutput.content;
        }

        let parsed: any = rawOutput;
        if (asText) {
          try {
            parsed = JSON.parse(asText);
          } catch {
            parsed = asText;
          }
        }

        yield { kind: "tool", toolName, output: parsed };
      }
    }
  }

  public async addItemsToNotebook(
    userId: string,
    notebookId: string,
    prompt: string,
  ) {
    if (!userId) throw new Error("userId is required");
    if (!notebookId) throw new Error("notebookId is required");
    if (!prompt) throw new Error("prompt is required");

    const notebooks = await this.notebookService.findByUserId(userId);
    const notebook = notebooks.find((nb) => nb.id.toString() === notebookId);
    if (!notebook) {
      throw new NotFoundException("Không tìm thấy sổ tay của bạn");
    }

    const result = await addGeneratedNotebookItems(
      this.notebookAIService,
      this.notebookItemService,
      notebookId,
      prompt,
    );

    return {
      ...result,
      notebookName: notebook.name,
    };
  }
}

export type StreamReplyEvent =
  | { kind: "token"; text: string }
  | { kind: "tool"; toolName: string; output: any };
