import { Controller, Param, Post, Body, Put, Get, Res, Req, Delete } from '@nestjs/common';
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

    @Post()
    async create(@Req() req: any, @Body() dto: CreateNotebookDto): Promise<Notebook>{
        const userId = req.user.sub;
        return this.NotebookService.create(userId, dto)
    }

    @Put(':id')
    @Public()
    async update(@Param('id') id: string, @Body() dto: CreateNotebookDto): Promise<Notebook>{
        return this.NotebookService.update(id, dto)
    }

    @Get()
    @Public()
    async getAll(): Promise<Notebook[]>{
        return this.NotebookService.getAll();
    }
    @Delete(":id")
    async delete(@Param("id") id: string): Promise<Notebook> {
        return this.NotebookService.delete(id);
    }

    @Get("/my_notebook")
    async getByUserId(@Req() req:any):Promise<Notebook[]>{
        const id= req.user.sub;
        return this.NotebookService.getByUserId(id);
    }
}
