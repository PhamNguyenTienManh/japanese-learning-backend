import { Module } from '@nestjs/common';
import { AiChatSessionsService } from './ai_chat_sessions.service';
import { AiChatSessionsController } from './ai_chat_sessions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AIChatSession, AIChatSessionSchema } from './schemas/ai_chat_sessions.schema';
import { AIChatDailyUsage, AIChatDailyUsageSchema } from './schemas/ai_chat_daily_usage.schema';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AIChatSession.name, schema: AIChatSessionSchema },
      { name: AIChatDailyUsage.name, schema: AIChatDailyUsageSchema },
    ]), AiModule
  ],
  providers: [AiChatSessionsService],
  controllers: [AiChatSessionsController],
   exports: [AiChatSessionsService],
})
export class AiChatSessionsModule {}
