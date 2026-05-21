import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import {
  AIChatSession,
  ChatMessage,
  ChatMessageAction,
} from "./schemas/ai_chat_sessions.schema";
import { AIChatDailyUsage } from "./schemas/ai_chat_daily_usage.schema";
import { ConfirmNotebookAddDto, CreateMessageDto } from "./dto/ai-chat.dto";
import { ChatAgent } from "../ai/agent/chat.agent";

const DAILY_AI_LIMIT = 50;
const DAILY_AI_LIMIT_CODE = "DAILY_AI_LIMIT_EXCEEDED";
const HANOI_TIMEZONE = "Asia/Ho_Chi_Minh";

const NOTEBOOK_TOOL_NAMES = new Set([
  "create_notebook",
  "create_named_notebook",
  "search_notebook_by_name",
  "add_notebook_items",
  "list_user_notebooks",
  "get_notebook_items",
]);

function buildNotebookActions(
  toolName: string,
  output: any,
): ChatMessageAction[] {
  if (!output || typeof output !== "object") return [];
  if (output.success !== true) return [];

  if (toolName === "search_notebook_by_name") {
    const prompt =
      typeof output.addPrompt === "string" ? output.addPrompt.trim() : "";
    if (!prompt) return [];

    const candidates = Array.isArray(output.candidates)
      ? output.candidates
          .filter((candidate: any) => candidate?.id && candidate?.name)
          .slice(0, 10)
          .map((candidate: any) => ({
            id: String(candidate.id),
            name: String(candidate.name),
            score:
              typeof candidate.score === "number" ? candidate.score : undefined,
          }))
      : [];

    if (output.needsConfirmation && output.bestCandidate?.id) {
      return [
        {
          type: "confirm_add_to_notebook",
          label: `Có, thêm vào "${output.bestCandidate.name}"`,
          notebookId: String(output.bestCandidate.id),
          notebookName: output.bestCandidate.name,
          prompt,
          candidates,
        },
      ];
    }

    if (candidates.length > 0) {
      return [
        {
          type: "select_notebook_for_add",
          label: output.noMatch
            ? "Chọn một sổ tay để thêm"
            : "Chọn sổ tay phù hợp",
          prompt,
          candidates,
        },
      ];
    }

    return [];
  }

  // list_user_notebooks: 1 action cho mỗi sổ
  if (toolName === "list_user_notebooks" && Array.isArray(output.notebooks)) {
    return output.notebooks
      .filter((nb: any) => nb && nb.id)
      .map((nb: any) => ({
        type: "view_notebook" as const,
        label: nb.name ? `Mở "${nb.name}"` : "Mở sổ tay",
        notebookId: String(nb.id),
        notebookName: nb.name,
      }));
  }

  // Còn lại: 1 action duy nhất khi output có notebookId
  const notebookId = output.notebookId;
  if (!notebookId) return [];

  let label = "Xem sổ tay đã tạo";
  if (toolName === "add_notebook_items") label = "Xem sổ tay đã cập nhật";
  else if (toolName === "get_notebook_items") label = "Mở sổ tay";

  return [
    {
      type: "view_notebook",
      label,
      notebookId: String(notebookId),
      notebookName: output.notebookName,
    },
  ];
}

@Injectable()
export class AiChatSessionsService {
  constructor(
    @InjectModel(AIChatSession.name)
    private aiChatSessionModel: Model<AIChatSession>,
    @InjectModel(AIChatDailyUsage.name)
    private aiChatDailyUsageModel: Model<AIChatDailyUsage>,
    private readonly chatAgent: ChatAgent
  ) {}

  private readonly logger = new Logger(AiChatSessionsService.name);

  private getUserSessionQuery(userId: string) {
    const ownerQuery =
      Types.ObjectId.isValid(userId)
        ? {
            $or: [
              { userId: new Types.ObjectId(userId) },
              { userId },
            ],
          }
        : { userId };

    return {
      ...ownerQuery,
      isDeleted: { $ne: true },
      deletedAt: null,
    };
  }

  private getContextMessages(messages: ChatMessage[]): ChatMessage[] {
    return (messages || [])
      .filter((message) => message?.content)
      .slice(-10);
  }

  private getHanoiDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: HANOI_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  private getUsageUserId(userId: string) {
    return Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
  }

  private formatUsage(usage: any, dateKey: string) {
    const limit = DAILY_AI_LIMIT;
    const used = Math.min(Number(usage?.used || 0), limit);

    return {
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      dateKey,
    };
  }

  async getTodayUsage(userId: string) {
    const dateKey = this.getHanoiDateKey();
    const usage = await this.aiChatDailyUsageModel
      .findOne({
        userId: this.getUsageUserId(userId),
        dateKey,
      })
      .lean();

    return this.formatUsage(usage, dateKey);
  }

  private async consumeTodayQuota(userId: string) {
    const dateKey = this.getHanoiDateKey();
    const usageUserId = this.getUsageUserId(userId);
    const incremented = await this.aiChatDailyUsageModel
      .findOneAndUpdate(
        {
          userId: usageUserId,
          dateKey,
          used: { $lt: DAILY_AI_LIMIT },
        },
        {
          $inc: { used: 1 },
          $set: { limit: DAILY_AI_LIMIT },
        },
        { new: true },
      )
      .lean();

    if (incremented) {
      return { allowed: true, usage: this.formatUsage(incremented, dateKey) };
    }

    const existing = await this.aiChatDailyUsageModel
      .findOne({ userId: usageUserId, dateKey })
      .lean();

    if (existing) {
      return { allowed: false, usage: this.formatUsage(existing, dateKey) };
    }

    try {
      const created = await this.aiChatDailyUsageModel.create({
        userId: usageUserId,
        dateKey,
        used: 1,
        limit: DAILY_AI_LIMIT,
      });

      return { allowed: true, usage: this.formatUsage(created, dateKey) };
    } catch {
      return this.consumeTodayQuota(userId);
    }
  }

  private buildQuotaExceededPayload(usage: any) {
    return {
      code: DAILY_AI_LIMIT_CODE,
      message:
        "Bạn đã dùng hết 50 request AI hôm nay. Quay lại vào ngày mai nhé.",
      usage,
    };
  }

  private buildTitleFromMessage(content: string): string {
    const normalized = (content || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "Cuộc trò chuyện mới";
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
  }

  private buildNotebookAddResultMessage(result: any): string {
    const notebookName = result?.notebookName || "sổ tay đã chọn";
    const itemsCount = Number(result?.itemsCount || 0);
    const requestedCount = Number(result?.requestedCount || itemsCount);

    if (itemsCount <= 0) {
      return `Mình chưa thêm được từ mới nào vào sổ tay "${notebookName}".`;
    }

    if (result?.isComplete) {
      return `Đã thêm đủ ${itemsCount}/${requestedCount} từ mới vào sổ tay "${notebookName}".`;
    }

    return `Mình chỉ thêm được ${itemsCount}/${requestedCount} từ mới vào sổ tay "${notebookName}" vì chưa sinh đủ mục không trùng.`;
  }

  private consumeNotebookChoiceActions(
    session: AIChatSession,
    prompt: string,
    notebookId: string,
  ) {
    const normalizedPrompt = (prompt || "").trim();

    for (const message of session.messages || []) {
      if (!Array.isArray(message.actions)) continue;

      message.actions = message.actions.map((action) => {
        if (
          action.type !== "confirm_add_to_notebook" &&
          action.type !== "select_notebook_for_add"
        ) {
          return action;
        }

        const samePrompt = (action.prompt || "").trim() === normalizedPrompt;
        const sameNotebook =
          action.notebookId === notebookId ||
          (Array.isArray(action.candidates) &&
            action.candidates.some((candidate) => candidate.id === notebookId));

        return samePrompt && sameNotebook
          ? { ...action, consumed: true }
          : action;
      });
    }
  }

  private assertSessionOwner(session: AIChatSession, userId: string) {
    if (session.userId?.toString() !== userId) {
      throw new ForbiddenException("You do not own this session");
    }

    if (session.isDeleted || session.deletedAt) {
      throw new NotFoundException("Session not found");
    }
  }

  async createSession(userId: string) {
    return this.aiChatSessionModel.create({
      userId,
      messages: [],
      title: "Cuộc trò chuyện mới",
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    });
  }

  public async sendMessage(
    sessionId: string,
    createMessageDto: { content: string },
    userId: string
  ) {
    this.logger.debug(
      `sendMessage called with sessionId=${sessionId}, userId=${userId}`
    );

    // Tìm session
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    const quota = await this.consumeTodayQuota(userId);
    if (!quota.allowed) {
      throw new HttpException(
        this.buildQuotaExceededPayload(quota.usage),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const contextMessages = this.getContextMessages(session.messages);

    // Push user message vào session
    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(createMessageDto.content);
    }

    try {
      // GỌI CHAT AGENT
      const aiResponse = await this.chatAgent.chatReply(
        session.messages, // messages
        createMessageDto.content, // userMessage
        sessionId, // sessionId
        userId, // userId
        contextMessages,
      );

      // Lưu message AI
      const aiMsg: ChatMessage = {
        role: "ai",
        content: aiResponse,
        timestamp: new Date(),
      };
      session.messages.push(aiMsg);

      await session.save();

      // Trả kết quả về client
      return {
        sessionId: session._id,
        userMessage: userMsg.content,
        aiMessage: aiMsg.content,
        timestamp: new Date(),
        usage: quota.usage,
      };
    } catch (error) {
      // rollback nếu lỗi
      session.messages.pop();
      await session.save();

      this.logger.error("Failed to get AI response", error);
      throw new InternalServerErrorException("AI service unavailable");
    }
  }

  /**
   * Stream phản hồi AI dạng SSE event.
   * Yield: { type: "chunk", text } cho mỗi token, sau đó { type: "done", ... }.
   * Lưu cả user message và AI message vào DB ở cuối.
   */
  public async *streamMessage(
    sessionId: string,
    createMessageDto: { content: string },
    userId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<Record<string, any>, void, void> {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");

    this.assertSessionOwner(session, userId);
    const quota = await this.consumeTodayQuota(userId);
    if (!quota.allowed) {
      yield {
        type: "error",
        ...this.buildQuotaExceededPayload(quota.usage),
      };
      return;
    }

    const contextMessages = this.getContextMessages(session.messages);

    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(createMessageDto.content);
    }

    let fullText = "";
    const actions: ChatMessageAction[] = [];
    let wasAborted = false;
    try {
      for await (const evt of this.chatAgent.streamReply(
        createMessageDto.content,
        sessionId,
        userId,
        contextMessages,
        signal,
      )) {
        if (signal?.aborted) {
          wasAborted = true;
          break;
        }

        if (evt.kind === "token") {
          fullText += evt.text;
          yield { type: "chunk", text: evt.text };
        } else if (
          evt.kind === "tool" &&
          NOTEBOOK_TOOL_NAMES.has(evt.toolName)
        ) {
          const newActions = buildNotebookActions(evt.toolName, evt.output);
          for (const action of newActions) {
            const exists = actions.some(
              (a) =>
                a.notebookId === action.notebookId && a.type === action.type,
            );
            if (!exists) {
              actions.push(action);
              yield { type: "action", action };
            }
          }
        }
      }

      if (signal?.aborted) {
        wasAborted = true;
      }

      const aiMsg: ChatMessage = {
        role: "ai",
        content:
          fullText.trim().length > 0
            ? fullText
            : wasAborted
              ? "Đã dừng phản hồi."
              : "Xin lỗi, mình chưa có phản hồi phù hợp",
        timestamp: new Date(),
        actions,
      };
      session.messages.push(aiMsg);
      await session.save();

      yield {
        type: wasAborted ? "aborted" : "done",
        sessionId: session._id,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions,
        usage: quota.usage,
      };
    } catch (error) {
      if (signal?.aborted) {
        if (fullText.length === 0) {
          const aiMsg: ChatMessage = {
            role: "ai",
            content: "Đã dừng phản hồi.",
            timestamp: new Date(),
            actions,
          };
          session.messages.push(aiMsg);
        } else {
          const aiMsg: ChatMessage = {
            role: "ai",
            content: fullText,
            timestamp: new Date(),
            actions,
          };
          session.messages.push(aiMsg);
        }
        await session.save();
        return;
      }

      // rollback user message nếu lỗi và chưa có chunk nào được sinh
      if (fullText.length === 0) {
        session.messages.pop();
        await session.save();
      } else {
        // đã sinh được một phần, lưu phần đã có để không mất
        const aiMsg: ChatMessage = {
          role: "ai",
          content: fullText,
          timestamp: new Date(),
          actions,
        };
        session.messages.push(aiMsg);
        await session.save();
      }

      this.logger.error("Failed to stream AI response", error);
      yield {
        type: "error",
        message: "AI service unavailable",
      };
    }
  }

  async getSessionHistory(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);
    return session;
  }

  public async addNotebookItemsFromAction(
    sessionId: string,
    payload: ConfirmNotebookAddDto,
    userId: string,
  ) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    const quota = await this.consumeTodayQuota(userId);
    if (!quota.allowed) {
      throw new HttpException(
        this.buildQuotaExceededPayload(quota.usage),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.chatAgent.addItemsToNotebook(
      userId,
      payload.notebookId,
      payload.prompt,
    );
    const notebookName = result?.notebookName || "sổ tay đã chọn";

    this.consumeNotebookChoiceActions(
      session,
      payload.prompt,
      payload.notebookId,
    );
    session.markModified("messages");

    const userMsg: ChatMessage = {
      role: "user",
      content: `Xác nhận thêm "${payload.prompt}" vào sổ tay "${notebookName}".`,
      timestamp: new Date(),
    };
    const actions: ChatMessageAction[] = [
      {
        type: "view_notebook",
        label: "Xem sổ tay đã cập nhật",
        notebookId: payload.notebookId,
        notebookName,
      },
    ];
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildNotebookAddResultMessage(result),
      timestamp: new Date(),
      actions,
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      result,
      usage: quota.usage,
    };
  }

  async getUserSessions(userId: string) {
    if (!userId) return [];

    return this.aiChatSessionModel
      .find(this.getUserSessionQuery(userId))
      .sort({ isPinned: -1, updatedAt: -1 })
      .limit(50)
      .lean();
  }

  async getLastUserSession(userId: string) {
    if (!userId) return null;

    const session = await this.aiChatSessionModel
      .findOne(this.getUserSessionQuery(userId)) // findOne sẽ lấy 1 document
      .sort({ isPinned: -1, updatedAt: -1 }) // sắp xếp theo cập nhật mới nhất
      .lean();

    return session || null; // trả về null nếu không tìm thấy
  }

  async getGuestSessions() {
    return this.aiChatSessionModel
      .find({ userId: null, isDeleted: { $ne: true }, deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(10);
  }

  async updateSession(
    sessionId: string,
    userId: string,
    payload: { title?: string; isPinned?: boolean },
  ) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    if (typeof payload.title === "string") {
      const title = payload.title.replace(/\s+/g, " ").trim();
      session.title = title || "Cuộc trò chuyện mới";
    }

    if (typeof payload.isPinned === "boolean") {
      session.isPinned = payload.isPinned;
    }

    await session.save();
    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    session.isDeleted = true;
    session.deletedAt = new Date();
    session.isActive = false;
    await session.save();

    return { message: "Session deleted successfully" };
  }

  async closeSession(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);
    session.isActive = false;
    await session.save();
    return session;
  }
}
