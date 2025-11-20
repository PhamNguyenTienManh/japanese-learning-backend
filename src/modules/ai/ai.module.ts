import { Module } from '@nestjs/common';
import { GeminiProvider } from './provider/gemini.provider';
import { ChatAgent } from './agent/chat.agent';


@Module({
providers: [GeminiProvider, ChatAgent],
exports: [GeminiProvider, ChatAgent],
})
export class AiModule {}