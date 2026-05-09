import {
  ForbiddenException,
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
import { CreateMessageDto } from "./dto/ai-chat.dto";
import { ChatAgent } from "../ai/agent/chat.agent";

const NOTEBOOK_TOOL_NAMES = new Set([
  "create_notebook",
  "create_named_notebook",
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
    private readonly chatAgent: ChatAgent
  ) {}

  private readonly logger = new Logger(AiChatSessionsService.name);

  async createSession(userId: string) {
    return this.aiChatSessionModel.create({
      userId,
      messages: [],
      isActive: true,
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

    // Check quyền sở hữu
    if (session.userId?.toString() !== userId) {
      throw new ForbiddenException("You do not own this session");
    }

    // Push user message vào session
    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    try {
      // GỌI CHAT AGENT
      const aiResponse = await this.chatAgent.chatReply(
        session.messages, // messages
        createMessageDto.content, // userMessage
        sessionId, // sessionId
        userId // userId
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
  ): AsyncGenerator<Record<string, any>, void, void> {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");

    if (session.userId?.toString() !== userId) {
      throw new ForbiddenException("You do not own this session");
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    let fullText = "";
    const actions: ChatMessageAction[] = [];
    try {
      for await (const evt of this.chatAgent.streamReply(
        createMessageDto.content,
        sessionId,
        userId,
      )) {
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

      const aiMsg: ChatMessage = {
        role: "ai",
        content:
          fullText.trim().length > 0
            ? fullText
            : "Xin lỗi, mình chưa có phản hồi phù hợp",
        timestamp: new Date(),
        actions,
      };
      session.messages.push(aiMsg);
      await session.save();

      yield {
        type: "done",
        sessionId: session._id,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions,
      };
    } catch (error) {
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

  async getSessionHistory(sessionId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    return session;
  }

  async getUserSessions(userId: string) {
    if (!userId) return [];

    const query: any = {};
    if (Types.ObjectId.isValid(userId)) {
      query.$or = [
        { userId: new Types.ObjectId(userId) }, // ObjectId
        { userId: userId }, // fallback string
      ];
    } else {
      query.userId = userId;
    }

    return this.aiChatSessionModel
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
  }

  async getLastUserSession(userId: string) {
    if (!userId) return null;

    const query: any = {};
    if (Types.ObjectId.isValid(userId)) {
      query.$or = [
        { userId: new Types.ObjectId(userId) }, // ObjectId
        { userId: userId }, // fallback string
      ];
    } else {
      query.userId = userId;
    }

    const session = await this.aiChatSessionModel
      .findOne(query) // findOne sẽ lấy 1 document
      .sort({ updatedAt: -1 }) // sắp xếp theo cập nhật mới nhất
      .lean();

    return session || null; // trả về null nếu không tìm thấy
  }

  async getGuestSessions() {
    return this.aiChatSessionModel
      .find({ userId: null })
      .sort({ updatedAt: -1 })
      .limit(10);
  }

  async deleteSession(sessionId: string) {
    const result = await this.aiChatSessionModel.findByIdAndDelete(sessionId);
    if (!result) throw new NotFoundException("Session not found");
    return { message: "Session deleted successfully" };
  }

  async closeSession(sessionId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    session.isActive = false;
    await session.save();
    return session;
  }
}
