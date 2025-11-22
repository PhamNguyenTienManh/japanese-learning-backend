import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotebookItem } from './schemas/notebook-item.schema';
import { Model } from 'mongoose';
import { CreateNotebookItemDto } from './dto/create-notebookItem.dto';
import { Notebook } from '../notebook/schemas/notebook.schema';

@Injectable()
export class NotebookItemService {
    constructor(
        @InjectModel(NotebookItem.name)
        private readonly noteBookItemModel: Model<NotebookItem>,

        @InjectModel(Notebook.name)
        private readonly notebookModel: Model<Notebook>,
    ) { }

    async create(notebookId: string, dto: CreateNotebookItemDto): Promise<NotebookItem> {
        const notebook = await this.notebookModel.findById(notebookId);
        if(!notebook) throw new NotFoundException("Notebook not found")
        dto.notebook_id = notebookId
        const notebookItem = new this.noteBookItemModel(dto)
        return notebookItem.save();
    }

    async update(id: string, dto: CreateNotebookItemDto): Promise<any>{
        return this.noteBookItemModel.findByIdAndUpdate(
            id, 
            dto, 
            {new: true}
        );
    }

    async delete(id: string): Promise<any>{
        return this.noteBookItemModel.findByIdAndDelete(id);
    }
}
