// chat.agent.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { 
  createNotebookTool, 
  searchNotebookByNameTool, 
  addNotebookItemsTool, 
  createNamedNotebookTool
} from '../tools/notebookTools';
import { NotebookAgent } from './notebook.agent';
import { NotebookService } from 'src/modules/notebook/notebook.service';
import { NotebookItemService } from 'src/modules/notebook-item/notebook-item.service';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { InMemoryChatMessageHistory, BaseChatMessageHistory } from '@langchain/core/chat_history';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { GoogleGenAIClient } from '../provider/googleGenAIClient';
import { ToolInterface } from '@langchain/core/tools';

export type ChatRole = 'user' | 'ai';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

@Injectable()
export class ChatAgent {
  private readonly logger = new Logger(ChatAgent.name);

  private tools: ToolInterface[]; // Đổi thành array
  private executor?: AgentExecutor;
  private withHistory?: RunnableWithMessageHistory<any, any>;
  private histories = new Map<string, BaseChatMessageHistory>();
  private systemPrompt: string;

  constructor(
    private readonly googleGenAIClient: GoogleGenAIClient,
    private readonly notebookAgent: NotebookAgent,
    private readonly notebookService: NotebookService,
    private readonly notebookItemService: NotebookItemService,
  ) {
    this.systemPrompt = this.loadSystemPrompt();

    // Đăng ký TẤT CẢ 3 tools
    this.tools = [
      createNotebookTool(
        this.notebookAgent,
        this.notebookService,
        this.notebookItemService
      ) as unknown as ToolInterface,

      createNamedNotebookTool(
        this.notebookAgent,
        this.notebookService,
        this.notebookItemService
    ) as unknown as ToolInterface,
      
      searchNotebookByNameTool(
        this.notebookService
      ) as unknown as ToolInterface,
      
      addNotebookItemsTool(
        this.notebookAgent,
        this.notebookItemService
      ) as unknown as ToolInterface,
    ];

    this.logger.log(`Registered ${this.tools.length} tools: ${this.tools.map(t => t.name).join(', ')}`);
  }

  private loadSystemPrompt(): string {
    const path = 'src/modules/ai/prompts/system-chat.jp.txt';
    try {
      return fs.readFileSync(path, 'utf8');
    } catch {
      return `あなたは優しい日本語学習アシスタントです。`;
    }
  }

  private getHistory(sessionId: string): BaseChatMessageHistory {
    if (!sessionId) {
      this.logger.error('sessionId is missing in getHistory');
      throw new Error('sessionId is required');
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
      new MessagesPlaceholder('chat_history'),
      new MessagesPlaceholder('input'),
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = createToolCallingAgent({
      llm,
      tools: this.tools, // Dùng array tools
      prompt,
    });

    this.executor = new AgentExecutor({
      agent,
      tools: this.tools, // Dùng array tools
      maxIterations: 10, // Tăng lên để đủ cho multi-step workflow
      returnIntermediateSteps: true,
    });

    this.withHistory = new RunnableWithMessageHistory({
      runnable: this.executor,
      getMessageHistory: (sessionId: string) => {
        this.logger.debug(`getMessageHistory called with sessionId: ${sessionId}`);
        
        if (!sessionId || typeof sessionId !== 'string') {
          this.logger.error('Invalid sessionId:', sessionId);
          throw new Error('sessionId must be a string');
        }

        this.logger.debug(`Getting history for session: ${sessionId}`);
        return this.getHistory(sessionId);
      },
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
      outputMessagesKey: 'output',
    });

    this.logger.log('Agent executor initialized successfully');
  }

  /**
   * Gửi message tới AI và nhận phản hồi
   */
  public async chatReply(
    messages: ChatMessage[],
    userMessage: string,
    sessionId: string,
    userId: string
  ): Promise<string> {
    if (!sessionId) {
      this.logger.error('sessionId is missing');
      throw new Error('sessionId is required');
    }
    if (!userId) {
      this.logger.error('userId is missing');
      throw new Error('userId is required');
    }

    await this.initAgentExecutor();

    const humanMessage = new HumanMessage({ content: userMessage });
    
    const payload = { 
      input: userMessage  // Hoặc có thể dùng object: { content: userMessage }
    };

    const config = {
      configurable: {
        sessionId: sessionId,
        userId: userId,
      }
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

      // Lấy output - đã là string hoặc AgentFinish
      const output = result?.output;
      
      // Nếu là object phức tạp, extract text content
      if (typeof output === 'object' && output !== null) {
        // Có thể là AgentFinish hoặc structure khác
        const text = output.text || output.content || JSON.stringify(output);
        return typeof text === 'string' ? text : JSON.stringify(text);
      }
      
      // Nếu đã là string, return luôn
      return typeof output === 'string' ? output : JSON.stringify(output);
    } catch (err) {
      this.logger.error('[ChatAgent] Failed to generate response');
      this.logger.error('Error:', err.message);
      this.logger.error('Stack:', err.stack);
      throw err;
    }
  }
}