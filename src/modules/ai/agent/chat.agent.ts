// chat.agent.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { createNotebookTool } from '../tools/notebookTools';
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

  private notebookToolInstance: ToolInterface;
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

    this.notebookToolInstance = createNotebookTool(
      this.notebookAgent,
      this.notebookService,
      this.notebookItemService
    ) as unknown as ToolInterface;
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

  // chat.agent.ts
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
    tools: [this.notebookToolInstance],
    prompt,
  });

  this.executor = new AgentExecutor({
    agent,
    tools: [this.notebookToolInstance],
    maxIterations: 8,
    returnIntermediateSteps: true,
  });

  // getMessageHistory nhận TRỰC TIẾP sessionId string
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
    input: [humanMessage] 
  };

  // Config chỉ cần sessionId (string) và userId trong configurable
  const config = {
    configurable: {
      sessionId: sessionId,  // LangChain sẽ tự động extract này
      userId: userId,        // Để tools có thể dùng
    }
  };

  this.logger.debug(` [ChatAgent] Invoking agent`);
  this.logger.debug(`   - sessionId: ${sessionId}`);
  this.logger.debug(`   - userId: ${userId}`);

  try {
    const result = await this.withHistory!.invoke(payload, config);

    this.logger.log(`Agent response received`);

    const out = result?.output ?? result;
    return typeof out === 'string' ? out : JSON.stringify(out);
  } catch (err) {
    this.logger.error('[ChatAgent] Failed to generate response');
    this.logger.error('Error:', err.message);
    this.logger.error('Stack:', err.stack);
    throw err;
  }
}
}