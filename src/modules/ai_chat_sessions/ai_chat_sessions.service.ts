import { Injectable, NotFoundException } from '@nestjs/common';
import { AIChatSession } from './schemas/ai_chat_sessions.schema';
import { Model, Types } from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectModel } from '@nestjs/mongoose';
import { CreateMessageDto} from './dto/ai-chat.dto';

@Injectable()
export class AiChatSessionsService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(
        @InjectModel(AIChatSession.name)
        private aiChatSessionModel: Model<AIChatSession>,
    ) {
        // Khởi tạo Gemini
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) {
        throw new Error(
            'GOOGLE_GEMINI_API_KEY is not defined in environment variables. ' +
            'Please add it to your .env file.'
        );
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        
        // Sử dụng model gemini-2.0-flash 
        this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        });
    }


    /**
     * Tạo session chat mới
     */
    async createSession(userId: string) {
        return this.aiChatSessionModel.create({
            userId,  // luôn từ token
            messages: [],
            isActive: true,
        });
    }

    /**
     * Gửi tin nhắn và nhận phản hồi từ AI
     */
    async sendMessage(sessionId: string, createMessageDto: CreateMessageDto) {
    // Tìm session
        const session = await this.aiChatSessionModel.findById(sessionId);
        if (!session) {
            throw new NotFoundException('Session not found');
        }

        // Thêm tin nhắn của user
        session.messages.push({
            role: 'user',
            content: createMessageDto.content,
            timestamp: new Date(),
        });

        // System prompt cố định, AI luôn giới thiệu mình là trợ lý học tập
        const systemPrompt = `
            あなたは優しい日本語学習アシスタントです。
            - 学習者の質問に日本語で答える
            - 間違いを優しく訂正する
            - 必要に応じてベトナム語で補足説明してもよい
            - ユーザーがレベル(N5, N4, N3, etc.)を指定した場合のみ、関連する文法や単語を紹介する
            - ユーザーが自己紹介をした場合は覚えて会話に反映する
            `;

        // Build history cho Gemini
        const history = this.buildChatHistory(session.messages, systemPrompt);

        try {
            const chat = this.model.startChat({
                history,
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                },
            });

            const result = await chat.sendMessage(createMessageDto.content);
            const aiResponse = result.response.text();

            // Lưu phản hồi AI
            session.messages.push({
                role: 'ai',
                content: aiResponse,
                timestamp: new Date(),
            });

            await session.save();

            return {
                sessionId: session._id,
                userMessage: createMessageDto.content,
                aiMessage: aiResponse,
                timestamp: new Date(),
            };
        } catch (error) {
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }

    /**
     * Build history cho Gemini, Convert messages thành format Gemini yêu cầu
     */
    private buildChatHistory(messages: any[], systemPrompt: string) {
        const history = [
            {
                role: 'user',
                parts: [{ text: 'こんにちは！日本語を勉強したいです。' }], // luôn user đầu tiên
            },
            {
                role: 'model',
                parts: [{ text: systemPrompt }], // system prompt đưa vào dạng model
            },
        ];

        // Lấy 10 message gần nhất
        const recentMessages = messages.slice(-10);

        for (const msg of recentMessages) {
            if (msg.role === 'user') {
                history.push({
                    role: 'user',
                    parts: [{ text: msg.content }],
                });
            } else if (msg.role === 'ai') {
                history.push({
                    role: 'model',
                    parts: [{ text: msg.content }],
                });
            }
        }

        return history;
    }


    /**
     * Lấy lịch sử chat của session
     */
    async getSessionHistory(sessionId: string) {
        const session = await this.aiChatSessionModel.findById(sessionId);
        if (!session) {
        throw new NotFoundException('Session not found');
        }
        return session;
    }

    /**
     * Lấy tất cả sessions của user
     */
    async getUserSessions(userId: string) {
        return this.aiChatSessionModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ updatedAt: -1 })
        .limit(20);
    }

    /**
     * Lấy sessions của guest (userId = null)
     */
    async getGuestSessions() {
        return this.aiChatSessionModel
        .find({ userId: null })
        .sort({ updatedAt: -1 })
        .limit(10);
    }

    /**
     * Xóa session
     */
    async deleteSession(sessionId: string) {
        const result = await this.aiChatSessionModel.findByIdAndDelete(sessionId);
        if (!result) {
        throw new NotFoundException('Session not found');
        }
        return { message: 'Session deleted successfully' };
    }

    /**
     * Đánh dấu session inactive
     */
    async closeSession(sessionId: string) {
        const session = await this.aiChatSessionModel.findById(sessionId);
        if (!session) {
        throw new NotFoundException('Session not found');
        }
        session.isActive = false;
        await session.save();
        return session;
    }
}
