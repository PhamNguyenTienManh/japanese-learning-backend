import { Injectable } from '@nestjs/common';
import { VertexAI } from '@google-cloud/vertexai';


@Injectable()
export class GeminiProvider {
    private readonly vertexAI: VertexAI;

    constructor() {
        const project = process.env.GOOGLE_CLOUD_PROJECT;
        if (!project) throw new Error('Missing GOOGLE_CLOUD_PROJECT');
        const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';

        this.vertexAI = new VertexAI({ project, location });
    }

    getChatModel() {
        return this.vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash-002' });
    }


    getVisionModel() {
        return this.vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash-002' });
    }
}
