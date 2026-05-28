import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotebookItem } from './schemas/notebook-item.schema';
import { Model, Types } from 'mongoose';
import { CreateNotebookItemDto } from './dto/create-notebookItem.dto';
import { Notebook } from '../notebook/schemas/notebook.schema';
import { UserActivitiesService } from '../user_activities/user_activities.service';
import {
    UserActivityTargetType,
    UserActivityType,
} from '../user_activities/schemas/user_activity.schema';

@Injectable()
export class NotebookItemService {
    constructor(
        @InjectModel(NotebookItem.name)
        private readonly noteBookItemModel: Model<NotebookItem>,

        @InjectModel(Notebook.name)
        private readonly notebookModel: Model<Notebook>,
        private readonly userActivitiesService: UserActivitiesService,
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
        const savedItem = await notebookItem.save();
        this.userActivitiesService.createSafely({
            userId: notebook.user_id,
            type: UserActivityType.NOTEBOOK_ITEM_ADDED,
            title: `Đã thêm "${savedItem.name}" vào sổ tay`,
            targetType: UserActivityTargetType.NOTEBOOK,
            targetId: notebook._id as Types.ObjectId,
            metadata: {
                itemId: String(savedItem._id),
                itemName: savedItem.name,
                itemType: savedItem.type,
                notebookName: notebook.name,
            },
        }, "Failed to create notebook item activity:");
        return savedItem;
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
