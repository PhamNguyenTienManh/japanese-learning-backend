import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';


@Injectable()
export class GeminiProvider {
    private readonly genAI: GoogleGenerativeAI;

    constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GOOGLE_GEMINI_API_KEY');

    this.genAI = new GoogleGenerativeAI(apiKey);
    }

    getChatModel() {
        return this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }


    getVisionModel() {
        return this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
}