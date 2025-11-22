// notebook.agent.ts
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ToolInterface } from '@langchain/core/tools';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { InMemoryChatMessageHistory, BaseChatMessageHistory } from '@langchain/core/chat_history';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { GoogleGenAIClient } from '../provider/googleGenAIClient';

export const NotebookResponseSchema = z.object({
  intent: z.string(),
  layout: z.enum(['notice', 'list', 'detail', 'result', 'html_embed']),
  message: z.string().min(1).max(300),
  actions: z.array(z.record(z.string(), z.unknown())).max(3).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
}).strict();

export class NotebookAgent {
  private executor?: AgentExecutor;
  private withHistory?: RunnableWithMessageHistory<Record<string, unknown>, Record<string, unknown>>;
  private client = new GoogleGenAIClient();
  private systemPrompt = 'あなたは優しい日本語学習アシスタントです。';
  private histories = new Map<string, BaseChatMessageHistory>();
  private tools: ToolInterface[] = [];

  constructor(tools: ToolInterface[]) {
    this.tools = tools;
  }

  private getHistory(sessionId: string): BaseChatMessageHistory {
    const h = this.histories.get(sessionId);
    if (h) return h;
    const created = new InMemoryChatMessageHistory();
    this.histories.set(sessionId, created);
    return created;
  }

  private async init(): Promise<void> {
    if (this.executor && this.withHistory) return;

    const llm = this.client.getModel();

    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(this.systemPrompt),
      new MessagesPlaceholder('chat_history'),
      new MessagesPlaceholder('human_input'),
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = createToolCallingAgent({
      llm,
      tools: this.tools,
      prompt,
    });

    this.executor = new AgentExecutor({
      agent,
      tools: this.tools,
      maxIterations: 8,
      returnIntermediateSteps: true,
    });

    this.withHistory = new RunnableWithMessageHistory({
      runnable: this.executor,
      getMessageHistory: async (config) => {
        const sessionId = (config?.configurable as Record<string, unknown>)?.sessionId as string;
        return this.getHistory(sessionId);
      },
      inputMessagesKey: 'human_input',
      historyMessagesKey: 'chat_history',
      outputMessagesKey: 'output',
    });
  }

  public async run(input: string, userId: string): Promise<Record<string, unknown>> {
    if (!this.executor || !this.withHistory) await this.init();

    const humanMessage = new HumanMessage({ content: input });

    const result = await this.withHistory!.invoke(
      { human_input: [humanMessage] },
      { configurable: { userId, sessionId: userId } }
    );

    const raw = result.output ?? '';
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);

    try {
      const parsed = JSON.parse(text);
      const valid = NotebookResponseSchema.safeParse(parsed);
      if (valid.success) return valid.data;
    } catch (err) {
      console.error('Failed to parse agent response', err);
    }

    return {
      intent: 'ERROR',
      layout: 'notice',
      message: 'Model cannot respond right now.',
      payload: { status: 'error' },
    };
  }

  /** Gọi LLM để tạo các notebook items */
    // Thay vì NotebookItem[]
  public async generateNotebookItems(prompt: string): Promise<any[]> {
    const llm = this.client.getModel();

    const fullPrompt = `
  ${this.systemPrompt}

  User request: ${prompt}

  IMPORTANT:
  - ALWAYS generate a JSON array.
  - No explanation, markdown, or code block.
  - Output example:
  [{"name":"日","notes":"Mặt trời","mean":"Sun","phonetic":"ひ"}]
  `;

    const response = await llm.invoke(fullPrompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    const cleaned = content.replace(/```json\n?/g, '').replace(/```[\s\S]*?\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          name: item.name ?? '',
          notes: item.notes ?? '',
          mean: item.mean ?? '',
          phonetic: item.phonetic ?? '',
        }));
      }
      return [];
    } catch (err) {
      console.error('Failed to parse notebook items:', err);
      console.error('Raw cleaned content:', cleaned);
      return [];
    }
  }

}
