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
  private systemPrompt = `Bạn là trợ lý học tiếng Nhật, LUÔN trả lời bằng TIẾNG VIỆT.

Bạn giúp người dùng:
- Dịch Nhật ⇆ Việt
- Giải thích ngữ pháp
- Tạo ví dụ và luyện hội thoại
- Giải thích từ vựng
- Hỗ trợ JLPT (N5-N1)
- 📘 Tạo và quản lý sổ tay từ vựng (Notebook)

---

## 📘 Notebook Tool 使用ガイド

### 🆕 新規作成する場合
**使うツール:** create_notebook

**いつ使う:**
- ユーザーが「作って」「作成して」「make」と言った時
- 既存のNotebook名を言及していない時

**例:**
✅ ユーザー「5つの単語帳を作って」→ create_notebook(prompt="5つの単語")
✅ ユーザー「N5漢字リスト作成」→ create_notebook(prompt="N5漢字")
❌ ユーザー「ABCに追加」→ create_notebook を呼ばない

---

### ➕ 既存Notebookに追加する場合
**使うツール:** search_notebook_by_name → add_notebook_items

**いつ使う:**
- ユーザーがNotebook名を言及した時
- 「〇〇に追加」「〇〇へ追加」と言った時

**手順（必ず2ステップ）:**

STEP 1: 検索する
search_notebook_by_name(keyword="ユーザーが言った名前", userId=userId)

STEP 2: 結果によって分岐

A) 見つかった場合:
返り値例: [{"id":"123","name":"ABCXYZ"}]
→ add_notebook_items(notebookId="123", prompt="追加する内容")

B) 見つからなかった場合 (返り値が []):
→ ユーザーに言う: 「"〇〇"という名前のNotebookが見つかりませんでした。新しく作成しますか？」
→ ユーザーが「はい」→ create_notebook(prompt=...)

**例:**
ユーザー: 「Notebook_GenAI_2025-11-20T19-44-14-877Zに5つ追加して」

1️⃣ search_notebook_by_name(keyword="Notebook_GenAI_2025-11-20T19-44-14-877Z", userId=userId)
2️⃣ 結果: [{"id":"456","name":"Notebook_GenAI_2025-11-20T19-44-14-877Z"}]
3️⃣ add_notebook_items(notebookId="456", prompt="5つの単語")

---

## ⚠️ 重要ルール

1. Notebook名が言及されたら必ず search_notebook_by_name から始める
2. search の返り値は JSON string → JSON.parse() で配列に変換
3. 空配列 [] = 見つからなかった
4. 見つからない時は必ず確認する（勝手に作成しない）
5. tool の返り値も JSON string → パースしてから使う

---

## 📋 出力フォーマット

Notebook items は必ず以下の形式で生成：
[
  {"name":"日","notes":"Mặt trời","mean":"Sun","phonetic":"ひ"},
  {"name":"月","notes":"Mặt trăng","mean":"Moon","phonetic":"つき"}
]

必須: name, notes, mean, phonetic`;

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
      maxIterations: 10, // Tăng lên để đủ cho workflow search → add
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
    
    console.log('=== AGENT RUN ===');
    console.log('User input:', input);
    console.log('User ID:', userId);
    
    const humanMessage = new HumanMessage({ content: input });
    const result = await this.withHistory!.invoke(
      { human_input: [humanMessage] },
      { configurable: { userId, sessionId: userId } }
    );
    
    console.log('Agent result:', JSON.stringify(result, null, 2));
    console.log('=================');
    
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

  public async generateNotebookItems(prompt: string): Promise<any[]> {
    const llm = this.client.getModel();
    const fullPrompt = `
あなたは日本語学習アシスタントです。

User request: ${prompt}

IMPORTANT:
- ALWAYS generate a JSON array.
- No explanation, markdown, or code block.
- Each item must have: name, notes (Vietnamese translation), mean (English meaning), phonetic (hiragana/katakana reading)
- Output example:
[{"name":"日","notes":"Mặt trời","mean":"Sun","phonetic":"ひ"}]

Generate the items now:
`;
    
    console.log('=== GENERATING ITEMS ===');
    console.log('Prompt:', prompt);
    
    const response = await llm.invoke(fullPrompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = content.replace(/```json\n?/g, '').replace(/```[\s\S]*?\n?/g, '').trim();

    console.log('Generated content:', cleaned);
    
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        const items = parsed.map(item => ({
          name: item.name ?? '',
          notes: item.notes ?? '',
          mean: item.mean ?? '',
          phonetic: item.phonetic ?? '',
        }));
        console.log('Parsed items:', items);
        console.log('========================');
        return items;
      }
      console.error('Not an array:', parsed);
      return [];
    } catch (err) {
      console.error('Failed to parse notebook items:', err);
      console.error('Raw cleaned content:', cleaned);
      console.log('========================');
      return [];
    }
  }
}