import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNotificationDto } from './dto/CreateNotificationDto';
import { Notification } from './schemas/notifications.schema';
import { Profile } from '../profiles/schemas/profiles.schema';
import { convertEventStreamToIterableReadableDataStream } from '@langchain/core/utils/event_source_parse';
import { log } from 'node:console';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<Notification>,
        @InjectModel(Profile.name)
        private readonly profileModel: Model<Profile>,
    ) { }

    async pushNotification(fromUserId: string, dto: CreateNotificationDto): Promise<any> {
        const userId = new Types.ObjectId(dto.userId);
        const fromUserIdObject = new Types.ObjectId(fromUserId)
        const targetObjectId = new Types.ObjectId(dto.targetId);

        const profile = await this.profileModel.findOne({ userId: fromUserIdObject })
        const ProfileId = profile?._id as Types.ObjectId;

        const notification = await this.notificationModel.create({
            userId: userId,
            fromProfileId: ProfileId,
            targetId: targetObjectId,
            title: dto.title,
            message: dto.message,
            isRead: false,
        })
        return {
            success: true,
            message: 'Notification pushed successfully',
            data: notification,
        };
    }

    async getNotification(userId: string): Promise<Notification[]> {
        const ObjectId = new Types.ObjectId(userId);
        return this.notificationModel.find({ userId: ObjectId })
    }

    async getUnreadCount(userId: string): Promise<number> {
        const ObjectId = new Types.ObjectId(userId);
        const notifications = await this.notificationModel.find({ userId: ObjectId });
        const response = notifications.filter((noti) => !noti.isRead)
        return response.length;
    }

    async markAsRead(id: string): Promise<Notification> {
        const notification = await this.notificationModel.findById(id);

        if (!notification) {
            throw new NotFoundException(`Notification with id ${id} not found`);
        }

        notification.isRead = !notification.isRead;

        return await notification.save();
    }
    async delete(id: string): Promise<Notification | null>{
        return this.notificationModel.findByIdAndDelete(id);
    } 

}
