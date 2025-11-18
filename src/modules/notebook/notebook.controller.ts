import { Controller, Param, Post, Body, Put } from '@nestjs/common';
import { NotebookItemService } from '../notebook-item/notebook-item.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { Notebook } from './schemas/notebook.schema';
import { Public } from '../auth/public.decorator';
import { NotebookService } from './notebook.service';

@Controller('notebook')
export class NotebookController {
    constructor(
        private readonly NotebookService: NotebookService,
    ){}

    @Post(':id')
    @Public()
    async create(@Param('id') userId: string, @Body() dto: CreateNotebookDto): Promise<Notebook>{
        return this.NotebookService.create(userId, dto)
    }

    @Put(':id')
    @Public()
    async update(@Param('id') id: string, @Body() dto: CreateNotebookDto): Promise<Notebook>{
        return this.NotebookService.update(id, dto)
    }
}
