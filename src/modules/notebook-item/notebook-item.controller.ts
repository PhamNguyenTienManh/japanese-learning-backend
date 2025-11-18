import { Controller, Post, Param, Body } from '@nestjs/common';
import { NotebookItemService } from './notebook-item.service';
import { Public } from '../auth/public.decorator';
import { NotebookItem } from './schemas/notebook-item.schema';
import { CreateNotebookItemDto } from './dto/create-notebookItem.dto';

@Controller('notebook-item')
export class NotebookItemController {
    constructor(
        private readonly noteBookItemService: NotebookItemService,
    ){}

    @Post(':id')
    @Public()
    async create(@Param('id') notebookId: string, @Body() dto: CreateNotebookItemDto):Promise<NotebookItem>{
        return this.noteBookItemService.create(notebookId, dto)
    }
}
