import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreateMessageDto } from './dto/ai-chat.dto';
import { AiChatSessionsService } from './ai_chat_sessions.service';
import { Public } from '../auth/public.decorator';

@Controller('ai-chat')
export class AiChatSessionsController {
    constructor(private readonly aiChatService: AiChatSessionsService) {}

    /**
     * POST /ai-chat/session
     * Tạo session mới
     */
    @Post()
    async createSession(@Req() req: any) {
        const userId = req.user.sub; // userId đã decode từ JWT
        return this.aiChatService.createSession(userId);
    }

    /**
     * POST /ai-chat/:sessionId/message
     * Gửi tin nhắn trong session
     */
    @Post(':sessionId/message')
    async sendMessage(
        @Param('sessionId') sessionId: string,
        @Body() createMessageDto: CreateMessageDto,
        @Req() req: any
    ) {
        const userId = req.user.sub;
        return this.aiChatService.sendMessage(sessionId, createMessageDto, userId);
    }

    /**
     * POST /ai-chat/:sessionId/message/stream
     * Gửi tin nhắn và nhận phản hồi token-by-token qua SSE
     */
    @Post(':sessionId/message/stream')
    async sendMessageStream(
        @Param('sessionId') sessionId: string,
        @Body() createMessageDto: CreateMessageDto,
        @Req() req: any,
        @Res() res: Response,
    ) {
        const userId = req.user.sub;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const writeEvent = (data: Record<string, any>) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            for await (const event of this.aiChatService.streamMessage(
                sessionId,
                createMessageDto,
                userId,
            )) {
                writeEvent(event);
            }
        } catch (err: any) {
            writeEvent({ type: 'error', message: err?.message ?? 'Stream failed' });
        } finally {
            res.end();
        }
    }

    /**
     * GET /ai-chat/:sessionId
     * Lấy lịch sử chat
     */
    @Public()
    @Get(':sessionId')
    async getSessionHistory(@Param('sessionId') sessionId: string) {
        return this.aiChatService.getSessionHistory(sessionId);
    }

    /**
     * GET /ai-chat/user/:userId
     * Lấy tất cả sessions của user
     */
    @Get('user/sessions')
    async getUserSessions( @Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.getLastUserSession(userId);
    }

    /**
     * GET /ai-chat/guest/sessions
     * Lấy sessions của guest
     */
    @Get('guest/sessions')
    async getGuestSessions() {
        return this.aiChatService.getGuestSessions();
    }

    /**
     * DELETE /ai-chat/:sessionId
     * Xóa session
     */
    @Delete(':sessionId')
    async deleteSession(@Param('sessionId') sessionId: string) {
        return this.aiChatService.deleteSession(sessionId);
    }

    /**
     * POST /ai-chat/:sessionId/close
     * Đóng session (đánh dấu inactive)
     */
    @Post(':sessionId/close')
    async closeSession(@Param('sessionId') sessionId: string) {
        return this.aiChatService.closeSession(sessionId);
    }
}
