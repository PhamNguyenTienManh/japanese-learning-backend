import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotebookItem } from './schemas/notebook-item.schema';
import { Model, Types } from 'mongoose';
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
        if (!notebook) throw new NotFoundException("Notebook not found");

        const existed = await this.noteBookItemModel.findOne({
            notebook_id: notebookId,
            name: dto.name,
            type: dto.type,
        });

        if (existed) {
            throw new BadRequestException("Từ này đã có trong sổ tay");
        }

        dto.notebook_id = notebookId;
        const notebookItem = new this.noteBookItemModel(dto);
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

    async getItemByNotebookId (notebookId: string):Promise<NotebookItem[]>{
        return this.noteBookItemModel.find({notebook_id: notebookId});
    }

}
