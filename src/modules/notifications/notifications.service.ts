import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNotificationDto } from './dto/CreateNotificationDto';
import { Notification } from './schemas/notifications.schema';
import { Profile } from '../profiles/schemas/profiles.schema';

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
        const fromUserIdObject = fromUserId ? new Types.ObjectId(fromUserId) : null;
        const targetObjectId = dto.targetId ? new Types.ObjectId(dto.targetId) : null;

        const profile = fromUserIdObject
            ? await this.profileModel.findOne({ userId: fromUserIdObject })
            : null;
        const ProfileId = profile?._id as Types.ObjectId;

        const notification = await this.notificationModel.create({
            userId: userId,
            fromProfileId: ProfileId || null,
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

    async createSystemNotification(dto: CreateNotificationDto): Promise<Notification> {
        return this.notificationModel.create({
            userId: new Types.ObjectId(dto.userId),
            fromProfileId: null,
            targetId: dto.targetId ? new Types.ObjectId(dto.targetId) : null,
            title: dto.title,
            message: dto.message,
            isRead: false,
        });
    }

    async getNotification(userId: string): Promise<Notification[]> {
  return this.notificationModel
    .find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })  
    .exec();
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
