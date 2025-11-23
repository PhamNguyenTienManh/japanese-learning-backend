// notebookTools.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { NotebookAgent } from '../agent/notebook.agent';
import { NotebookService } from 'src/modules/notebook/notebook.service';
import { NotebookItemService } from 'src/modules/notebook-item/notebook-item.service';
import { RunnableConfig } from '@langchain/core/runnables';

// ==================== TOOL 1: TẠO NOTEBOOK MỚI ====================
export const createNotebookTool = (
  notebookAgent: NotebookAgent,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService
) => {
  const toolFunc = async (input: { prompt: string }, config?: RunnableConfig) => {
    console.log('=== CREATE NOTEBOOK TOOL CALLED ===');
    console.log('Input:', input);
    console.log('Config:', config?.configurable);
    
    const userId = config?.configurable?.userId as string;
    
    if (!userId) {
      console.error('ERROR: userId not found in config!');
      throw new Error('userId is required from config');
    }

    console.log('Using userId:', userId);

    // Tạo tên notebook tự động
    const notebookName = `Notebook_GenAI_${new Date().toISOString().replace(/[:.]/g,'-')}`;
    
    console.log('Creating notebook:', notebookName);

    // Tạo notebook
    const notebook = await notebookService.create(userId, { 
      user_id: userId, 
      name: notebookName,
    });
    
    console.log('Created notebook ID:', notebook.id);

    // Sinh items từ prompt
    const items = await notebookAgent.generateNotebookItems(input.prompt);

    // Thêm items vào notebook
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
    
    console.log(`Added ${items.length} items`);
    console.log('================================');

    return JSON.stringify({
      success: true,
      notebookId: notebook.id.toString(),
      notebookName: notebookName,
      itemsCount: items.length,
      message: `Created notebook "${notebookName}" with ${items.length} items`
    });
  };

  return tool(toolFunc, {
    name: 'create_notebook',
    description: 'Create a NEW Japanese learning notebook with vocabulary/kanji items. Use this when user says "create notebook", "make a notebook". Do NOT use when user mentions adding to an existing notebook.',
    schema: z.object({
      prompt: z.string().describe('What vocabulary/kanji to generate'),
    }),
  });
};

// ==================== TOOL 2: TÌM NOTEBOOK THEO TÊN ====================
export const searchNotebookByNameTool = (notebookService: NotebookService) => {
  const toolFunc = async (input: { keyword: string }, config?: RunnableConfig) => {
    console.log('=== SEARCH TOOL CALLED ===');
    console.log('Input:', input);
    console.log('Config:', config?.configurable);
    
    const userId = config?.configurable?.userId as string;
    
    if (!userId) {
      console.error('ERROR: userId not found in config!');
      throw new Error('userId is required from config');
    }

    console.log('Using userId:', userId);
    console.log('Searching for:', input.keyword);
    
    const notebooks = await notebookService.findByUserId(userId);
    
    console.log('=== SEARCH DEBUG ===');
    console.log('Total notebooks found:', notebooks.length);
    notebooks.forEach(nb => {
      console.log(`  - ID: ${nb.id}, Name: "${nb.name}"`);
    });
    
    const keywordLower = input.keyword.toLowerCase().trim();
    
    const results = notebooks.filter(nb => {
      const nameLower = nb.name.toLowerCase().trim();
      return nameLower === keywordLower || 
             nameLower.includes(keywordLower) || 
             keywordLower.includes(nameLower);
    });
    
    console.log('Matched results:', results.length);
    console.log('===================');
    
    return JSON.stringify(results.map(nb => ({ 
      id: nb.id.toString(), 
      name: nb.name 
    })));
  };

  return tool(toolFunc, {
    name: 'search_notebook_by_name',
    description: 'Find existing notebook by name. ALWAYS use this FIRST when user mentions adding to a specific notebook. Returns JSON array of matching notebooks.',
    schema: z.object({ 
      keyword: z.string().describe('Notebook name to search'),
    }),
  });
};

// ==================== TOOL 3: THÊM ITEMS VÀO NOTEBOOK CÓ SẴN ====================
export const addNotebookItemsTool = (
  notebookAgent: NotebookAgent,
  notebookItemService: NotebookItemService
) => {
  const toolFunc = async (input: { notebookId: string; prompt: string }, config?: RunnableConfig) => {
    console.log('=== ADD ITEMS TOOL CALLED ===');
    console.log('Input:', input);
    console.log('Config:', config?.configurable);
    
    if (!input.notebookId) throw new Error('notebookId is required');
    if (!input.prompt) throw new Error('prompt is required');

    // Sinh items từ prompt
    const items = await notebookAgent.generateNotebookItems(input.prompt);
    
    if (!items || items.length === 0) {
      throw new Error('Failed to generate items from prompt');
    }

    // Thêm items vào notebook
    for (const item of items) {
      await notebookItemService.create(input.notebookId, {
        notebook_id: input.notebookId,
        name: item.name ?? '',
        notes: item.notes ?? '',
        mean: item.mean ?? '',
        phonetic: item.phonetic ?? '',
        type: 'other',
      });
    }
    
    console.log(`Added ${items.length} items to notebook ${input.notebookId}`);
    console.log('================================');
    
    return JSON.stringify({
      success: true,
      notebookId: input.notebookId,
      itemsCount: items.length,
      message: `Added ${items.length} items to notebook`
    });
  };

  return tool(toolFunc, {
    name: 'add_notebook_items',
    description: 'Add vocabulary/kanji items to an EXISTING notebook. Use this AFTER search_notebook_by_name finds a notebook.',
    schema: z.object({
      notebookId: z.string().describe('ID of the existing notebook from search result'),
      prompt: z.string().describe('What items to generate and add'),
    }),
  });
};


// ==================== TOOL 4: TẠO NOTEBOOK VỚI TÊN TÙY CHỈNH ====================
export const createNamedNotebookTool = (
  notebookAgent: NotebookAgent,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService
) => {
  const toolFunc = async (
    input: { name: string; prompt: string }, 
    config?: RunnableConfig
  ) => {
    console.log('=== CREATE NAMED NOTEBOOK TOOL CALLED ===');
    console.log('Input:', input);
    console.log('Config:', config?.configurable);
    
    const userId = config?.configurable?.userId as string;
    
    if (!userId) {
      console.error('ERROR: userId not found in config!');
      throw new Error('userId is required from config');
    }

    if (!input.name || !input.prompt) {
      throw new Error('Both name and prompt are required');
    }

    console.log('Using userId:', userId);
    console.log('Notebook name:', input.name);

    // Tạo notebook với tên do user/AI chọn
    const notebook = await notebookService.create(userId, { 
      user_id: userId, 
      name: input.name,
    });
    
    console.log('Created notebook ID:', notebook.id);

    // Sinh items từ prompt
    const items = await notebookAgent.generateNotebookItems(input.prompt);

    // Thêm items vào notebook
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
    
    console.log(`Added ${items.length} items`);
    console.log('================================');

    return JSON.stringify({
      success: true,
      notebookId: notebook.id.toString(),
      notebookName: input.name,
      itemsCount: items.length,
      message: `Đã tạo sổ tay "${input.name}" với ${items.length} mục`
    });
  };

  return tool(toolFunc, {
    name: 'create_named_notebook',
    description: 'Create a new notebook with a CUSTOM NAME. Use when user specifies a notebook name OR when AI should create a meaningful name based on content. Example: "Từ vựng về gia đình", "Kanji N5 buổi 1".',
    schema: z.object({
      name: z.string().describe('The name for the new notebook (e.g., "Từ vựng về gia đình", "Kanji N5")'),
      prompt: z.string().describe('What vocabulary/kanji to generate'),
    }),
  });
};