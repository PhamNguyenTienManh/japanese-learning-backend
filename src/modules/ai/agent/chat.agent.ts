import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { GeminiProvider } from '../provider/gemini.provider';


@Injectable()
export class ChatAgent {
    private readonly logger = new Logger(ChatAgent.name);

    constructor(private readonly geminiProvider: GeminiProvider) {}

    private loadSystemPrompt(): string {
        const path = 'src/modules/ai/prompts/system-chat.jp.txt';
        try {
            return fs.readFileSync(path, 'utf8');
        } catch (err) {
            this.logger.warn(`Cannot read system prompt at ${path}, using fallback.`);
            return `あなたは優しい日本語学習アシスタントです。`;
        }
    }

    /**
    * Build history using messages stored in DB
    * messages: Array<{ role: 'user'|'ai', content: string, timestamp?: Date }>
    */
    buildHistory(messages: any[], systemPrompt: string) {
        const history: any[] = [];


        // Seed conversation with a friendly opening and system prompt
        history.push({ role: 'user', parts: [{ text: 'こんにちは！日本語を勉強したいです。' }] });
        history.push({ role: 'model', parts: [{ text: systemPrompt }] });


        const recent = messages.slice(-10);
        for (const msg of recent) {
        if (msg.role === 'user') {
            history.push({ role: 'user', parts: [{ text: msg.content }] });
        } else {
            history.push({ role: 'model', parts: [{ text: msg.content }] });
        }
        }
        return history;
    }


    async chatReply(messages: any[], userMessage: string, generationConfig = {}) {
        const systemPrompt = this.loadSystemPrompt();
        const history = this.buildHistory(messages, systemPrompt);
        const model = this.geminiProvider.getChatModel();
        const chat = model.startChat({ history, generationConfig: { maxOutputTokens: 1000, temperature: 0.7, ...generationConfig } });
        // Note: Gemini SDK may provide streaming APIs; here we keep simple request/response
        const result = await chat.sendMessage(userMessage);
        const aiResponse = result.response.text();

        return aiResponse;
    }
}