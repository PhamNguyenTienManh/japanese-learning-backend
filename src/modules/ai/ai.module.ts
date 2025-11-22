import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotebookService } from '../notebook/notebook.service';
import { NotebookItemService } from '../notebook-item/notebook-item.service';
import { Notebook, NotebookSchema } from '../notebook/schemas/notebook.schema';
import { NotebookItem, NotebookItemSchema } from '../notebook-item/schemas/notebook-item.schema';
import { GeminiProvider } from './provider/gemini.provider';
import { ChatAgent } from './agent/chat.agent';
import { NotebookAgent } from './agent/notebook.agent';
import { GoogleGenAIClient } from './provider/googleGenAIClient';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notebook.name, schema: NotebookSchema },
      { name: NotebookItem.name, schema: NotebookItemSchema },
    ]),
  ],
  providers: [
    ChatAgent,
    GeminiProvider,
    GoogleGenAIClient,
    NotebookAgent,
    NotebookService,
    NotebookItemService,
  ],
  exports: [GeminiProvider, ChatAgent, GoogleGenAIClient],
})
export class AiModule {}
