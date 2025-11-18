import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
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
        const userId = req.user.userId; // userId đã decode từ JWT
        return this.aiChatService.createSession(userId);
    }

    /**
     * POST /ai-chat/:sessionId/message
     * Gửi tin nhắn trong session
     */
    @Public()
    @Post(':sessionId/message')
    async sendMessage(
        @Param('sessionId') sessionId: string,
        @Body() createMessageDto: CreateMessageDto,
    ) {
        return this.aiChatService.sendMessage(sessionId, createMessageDto);
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
    @Get('user/:userId')
    async getUserSessions(@Param('userId') userId: string) {
        return this.aiChatService.getUserSessions(userId);
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
