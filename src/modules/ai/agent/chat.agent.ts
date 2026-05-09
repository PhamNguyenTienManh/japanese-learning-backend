// chat.agent.ts
import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import {
  createNotebookTool,
  searchNotebookByNameTool,
  addNotebookItemsTool,
  createNamedNotebookTool,
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
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { GoogleGenAIClient } from "../provider/googleGenAIClient";
import { ToolInterface } from "@langchain/core/tools";
import { NotebookAIService } from "../service/notebook-ai.service";

export type ChatRole = "user" | "ai";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

@Injectable()
export class ChatAgent {
  private readonly logger = new Logger(ChatAgent.name);

  private tools: ToolInterface[];
  private executor?: AgentExecutor;
  private withHistory?: RunnableWithMessageHistory<any, any>;
  private histories = new Map<string, BaseChatMessageHistory>();
  private systemPrompt: string;

  constructor(
    private readonly googleGenAIClient: GoogleGenAIClient,
    private readonly notebookAIService: NotebookAIService,
    private readonly notebookService: NotebookService,
    private readonly notebookItemService: NotebookItemService,
  ) {
    this.systemPrompt = this.loadSystemPrompt();

    // Đăng ký TẤT CẢ tools
    this.tools = [
      createNotebookTool(
        this.notebookAIService,
        this.notebookService,
        this.notebookItemService,
      ) as unknown as ToolInterface,

      createNamedNotebookTool(
        this.notebookAIService,
        this.notebookService,
        this.notebookItemService,
      ) as unknown as ToolInterface,

      searchNotebookByNameTool(
        this.notebookService,
      ) as unknown as ToolInterface,

      addNotebookItemsTool(
        this.notebookAIService,
        this.notebookItemService,
      ) as unknown as ToolInterface,
    ];

    this.logger.log(
      `Registered ${this.tools.length} tools: ${this.tools
        .map((t) => t.name)
        .join(", ")}`,
    );
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
      this.logger.debug(`Found existing history for session: ${sessionId}`);
      return this.histories.get(sessionId)!;
    }

    this.logger.debug(`Creating new history for session: ${sessionId}`);
    const history = new InMemoryChatMessageHistory();
    this.histories.set(sessionId, history);
    return history;
  }

  private async initAgentExecutor() {
    if (this.executor && this.withHistory) return;

    const llm = this.googleGenAIClient.getModel();

    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(this.systemPrompt),
      new MessagesPlaceholder("chat_history"),
      new MessagesPlaceholder("input"),
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = createToolCallingAgent({
      llm,
      tools: this.tools,
      prompt,
    });

    this.executor = new AgentExecutor({
      agent,
      tools: this.tools,
      maxIterations: 10,
      returnIntermediateSteps: true,
    });

    // Normalize output: Gemini trả array khi có emoji/special chars
    const normalizedExecutor = this.executor.pipe(
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

    this.withHistory = new RunnableWithMessageHistory({
      runnable: normalizedExecutor, // dùng normalizedExecutor
      getMessageHistory: (sessionId: string) => {
        this.logger.debug(
          `getMessageHistory called with sessionId: ${sessionId}`,
        );

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

    this.logger.log("Agent executor initialized successfully");
  }

  /**
   * Gửi message tới AI và nhận phản hồi
   */
  public async chatReply(
    messages: ChatMessage[],
    userMessage: string,
    sessionId: string,
    userId: string,
  ): Promise<string> {
    if (!sessionId) {
      this.logger.error("sessionId is missing");
      throw new Error("sessionId is required");
    }
    if (!userId) {
      this.logger.error("userId is missing");
      throw new Error("userId is required");
    }

    await this.initAgentExecutor();

    // Ép userMessage thành string an toàn
    const safeInput =
      typeof userMessage === "string" ? userMessage : String(userMessage);

    const payload = { input: safeInput };

    const config = {
      configurable: {
        sessionId,
        userId,
      },
    };

    this.logger.warn(`[ChatAgent] === CRITICAL DEBUG ===`);
    this.logger.warn(`  Input userId: ${userId}`);
    this.logger.warn(`  Input userId type: ${typeof userId}`);
    this.logger.warn(`  Input sessionId: ${sessionId}`);
    this.logger.warn(`  Config object: ${JSON.stringify(config, null, 2)}`);
    this.logger.warn(`  ================================`);

    try {
      const result = await this.withHistory!.invoke(payload, config);

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
      this.logger.error("Error:", err.message);
      this.logger.error("Stack:", err.stack);
      throw err;
    }
  }
}
