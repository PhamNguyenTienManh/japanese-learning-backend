import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { AIChatSession, ChatMessage } from "./schemas/ai_chat_sessions.schema";
import { CreateMessageDto } from "./dto/ai-chat.dto";
import { ChatAgent } from "../ai/agent/chat.agent";

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
