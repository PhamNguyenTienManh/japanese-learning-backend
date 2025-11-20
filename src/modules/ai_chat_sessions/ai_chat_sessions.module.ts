import { Module } from '@nestjs/common';
import { AiChatSessionsService } from './ai_chat_sessions.service';
import { AiChatSessionsController } from './ai_chat_sessions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AIChatSession, AIChatSessionSchema } from './schemas/ai_chat_sessions.schema';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AIChatSession.name, schema: AIChatSessionSchema }
    ]), AiModule
  ],
  providers: [AiChatSessionsService],
  controllers: [AiChatSessionsController],
   exports: [AiChatSessionsService],
})
export class AiChatSessionsModule {}
