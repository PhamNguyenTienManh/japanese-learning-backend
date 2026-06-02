import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Notebook } from './schemas/notebook.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UserActivitiesService } from '../user_activities/user_activities.service';
import { NotebookItem } from '../notebook-item/schemas/notebook-item.schema';
import {
    UserActivityTargetType,
    UserActivityType,
} from '../user_activities/schemas/user_activity.schema';

@Injectable()
export class NotebookService {
    constructor(
        @InjectModel(Notebook.name)
        private readonly notebook: Model<Notebook>,
        @InjectModel(NotebookItem.name)
        private readonly notebookItem: Model<NotebookItem>,
        private readonly userActivitiesService: UserActivitiesService,
    ) { }

    async create(userId: string, dto: CreateNotebookDto): Promise<Notebook> {
        dto.user_id = userId;
        const existed = await this.notebook.findOne({ name: dto.name, isDeleted: { $ne: true } })
        if (existed) throw new ConflictException("Name is duplicated");
        const notebook = new this.notebook(dto);
        const savedNotebook = await notebook.save();
        this.userActivitiesService.createSafely({
            userId,
            type: UserActivityType.NOTEBOOK_CREATED,
            title: `Đã tạo sổ tay: ${savedNotebook.name}`,
            targetType: UserActivityTargetType.NOTEBOOK,
            targetId: savedNotebook._id as Types.ObjectId,
            metadata: {
                notebookName: savedNotebook.name,
            },
        }, "Failed to create notebook activity:");
        return savedNotebook;
    }

    async update(id: string, dto: CreateNotebookDto): Promise<Notebook> {
        const notebook = await this.notebook.findOne({ _id: id, isDeleted: { $ne: true } });
        if (notebook) {
            if (dto.name) {
                const existed = await this.notebook.findOne({
                    _id: { $ne: id },
                    name: dto.name,
                    isDeleted: { $ne: true },
                })
                if (existed) throw new ConflictException("Name is duplicated");
                notebook.name = dto.name;
            } else if (dto.viewCount === true) {
                notebook.viewCount++;
            }
        } else throw new NotFoundException("Notebook not found");
        await notebook.save();
        return notebook;

    }

    async findByUserId(userId: string): Promise<Notebook[]> {
        if (!userId) throw new Error("userId is required");
        const notebooks = await this.notebook.find({ user_id: userId, isDeleted: { $ne: true } }).exec();
        return notebooks;
    }

    async getAll(): Promise<Notebook[]> {
        return this.notebook.find({ isDeleted: { $ne: true } });
    }

    async delete(id: string): Promise<Notebook> {
        const deletedAt = new Date();
        const deletedNotebook = await this.notebook.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { $set: { isDeleted: true, deletedAt } },
            { new: true },
        ).exec();

        if (!deletedNotebook) {
            throw new NotFoundException(`Notebook với id ${id} không tồn tại`);
        }

        await this.notebookItem.updateMany(
            { notebook_id: id, isDeleted: { $ne: true } },
            { $set: { isDeleted: true, deletedAt } },
        ).exec();

        return deletedNotebook;
    }

    async getByUserId(userId: string): Promise<Notebook[]>{
        return this.notebook.find({user_id: userId, isDeleted: { $ne: true }});
    }

    async searchByUserId(userId: string, keyword: string): Promise<Notebook[]> {
        if (!userId) throw new Error("userId is required");
        const filter: any = { user_id: userId, isDeleted: { $ne: true } };
        if (keyword && keyword.trim()) {
            const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escaped, $options: 'i' };
        }
        return this.notebook.find(filter).sort({ createdAt: -1 }).exec();
    }

}
