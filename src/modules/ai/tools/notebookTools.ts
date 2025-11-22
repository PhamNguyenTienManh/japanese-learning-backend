import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { NotebookAgent } from '../agent/notebook.agent';
import { NotebookService } from 'src/modules/notebook/notebook.service';
import { NotebookItemService } from 'src/modules/notebook-item/notebook-item.service';
import { RunnableConfig } from '@langchain/core/runnables';

export const createNotebookTool = (
  notebookAgent: NotebookAgent,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService
) =>
  tool(
    async (
      { prompt, userId }: { prompt: string; userId?: string }, 
      config: RunnableConfig
    ) => {
      const effectiveUserId = userId || (config?.configurable?.userId as string);
      if (!effectiveUserId) throw new Error('userId is required');

      console.log(`Creating notebook for user: ${effectiveUserId}`);

      // Tạo tên notebook tự động
      const notebookName = `Notebook_GenAI_${new Date().toISOString().replace(/[:.]/g,'-')}`;

      // Tạo notebook
      const notebook = await notebookService.create(effectiveUserId, { 
        user_id: effectiveUserId, 
        name: notebookName,
      });

      // Generate items từ NotebookAgent
      const items = await notebookAgent.generateNotebookItems(prompt);

      console.log("Items: ", items);
      console.log(`Generated ${items.length} items`);

      // Lưu từng item
      for (const item of items) {
        await notebookItemService.create(notebook.id.toString(), {
          notebook_id: notebook.id.toString(),
          name: item.name ?? '',
          notes: item.notes ?? '',
          mean: item.mean ?? '',
          phonetic: item.phonetic ?? '',
          type: 'other'
        });
      }

      return `Notebook "${notebookName}" created successfully with ${items.length} items!`;
    },
    {
      name: 'create_notebook',
      description: 'Create a Japanese learning notebook with kanji, words, grammar',
      schema: z.object({
        prompt: z.string().describe('What content to generate (e.g., "kanji about 日")'),
        userId: z.string().optional(),
      }),
    }
  );
