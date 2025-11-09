import { Module } from '@nestjs/common';
import { AiChatSessionsService } from './ai_chat_sessions.service';
import { AiChatSessionsController } from './ai_chat_sessions.controller';

@Module({
  providers: [AiChatSessionsService],
  controllers: [AiChatSessionsController]
})
export class AiChatSessionsModule {}
