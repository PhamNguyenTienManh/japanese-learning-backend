import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
    ConfirmNotebookAddDto,
    ConfirmNotebookCreateDto,
    CreateMessageDto,
    UpdateSessionDto,
} from './dto/ai-chat.dto';
import { AiChatSessionsService } from './ai_chat_sessions.service';

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

        const abortController = new AbortController();
        let isClosed = false;
        res.on('close', () => {
            isClosed = true;
            abortController.abort();
        });

        const writeEvent = (data: Record<string, any>) => {
            if (isClosed || res.destroyed) return;
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            for await (const event of this.aiChatService.streamMessage(
                sessionId,
                createMessageDto,
                userId,
                abortController.signal,
            )) {
                if (isClosed || res.destroyed) break;
                writeEvent(event);
            }
        } catch (err: any) {
            writeEvent({ type: 'error', message: err?.message ?? 'Stream failed' });
        } finally {
            if (!isClosed && !res.destroyed) {
                res.end();
            }
        }
    }

    /**
     * GET /ai-chat/user/:userId
     * Lấy tất cả sessions của user
     */
    @Get('user/sessions')
    async getUserSessions( @Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.getUserSessions(userId);
    }

    /**
     * GET /ai-chat/user/sessions/last
     * Lấy session mới nhất của user
     */
    @Get('user/sessions/last')
    async getLastUserSession(@Req() req: any) {
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
     * GET /ai-chat/usage/today
     * Lấy số request AI đã dùng trong ngày theo giờ Hà Nội
     */
    @Get('usage/today')
    async getTodayUsage(@Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.getTodayUsage(userId);
    }

    /**
     * POST /ai-chat/:sessionId/notebook-actions/add-items
     * Xác nhận/chọn sổ tay từ action UI rồi thêm từ vào sổ tay đó
     */
    @Post(':sessionId/notebook-actions/add-items')
    async addNotebookItemsFromAction(
        @Param('sessionId') sessionId: string,
        @Body() body: ConfirmNotebookAddDto,
        @Req() req: any,
    ) {
        const userId = req.user.sub;
        return this.aiChatService.addNotebookItemsFromAction(sessionId, body, userId);
    }

    /**
     * POST /ai-chat/:sessionId/notebook-actions/create-limited
     * Xác nhận tạo sổ tay khi yêu cầu ban đầu vượt giới hạn 30 từ vựng/lần
     */
    @Post(':sessionId/notebook-actions/create-limited')
    async createNotebookFromAction(
        @Param('sessionId') sessionId: string,
        @Body() body: ConfirmNotebookCreateDto,
        @Req() req: any,
    ) {
        const userId = req.user.sub;
        return this.aiChatService.createNotebookFromAction(sessionId, body, userId);
    }

    /**
     * GET /ai-chat/:sessionId
     * Lấy lịch sử chat
     */
    @Get(':sessionId')
    async getSessionHistory(@Param('sessionId') sessionId: string, @Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.getSessionHistory(sessionId, userId);
    }

    /**
     * PATCH /ai-chat/:sessionId
     * Đổi tên hoặc ghim session
     */
    @Patch(':sessionId')
    async updateSession(
        @Param('sessionId') sessionId: string,
        @Body() updateSessionDto: UpdateSessionDto,
        @Req() req: any,
    ) {
        const userId = req.user.sub;
        return this.aiChatService.updateSession(sessionId, userId, updateSessionDto);
    }

    /**
     * DELETE /ai-chat/:sessionId
     * Xóa session
     */
    @Delete(':sessionId')
    async deleteSession(@Param('sessionId') sessionId: string, @Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.deleteSession(sessionId, userId);
    }

    /**
     * POST /ai-chat/:sessionId/close
     * Đóng session (đánh dấu inactive)
     */
    @Post(':sessionId/close')
    async closeSession(@Param('sessionId') sessionId: string, @Req() req: any) {
        const userId = req.user.sub;
        return this.aiChatService.closeSession(sessionId, userId);
    }
}
