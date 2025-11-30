import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/CreateNotificationDto';
import { Notification } from './schemas/notifications.schema';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationsService) {}

  @Post('push')
  async pushNotification(@Req() req: any ,@Body() dto: CreateNotificationDto) {
    const fromUserId = req?.user.sub;
    return this.notificationService.pushNotification(fromUserId, dto);
  }

  @Get(":id")
  async getNotification(@Param("id") userId:string): Promise<Notification[]>{
    return this.notificationService.getNotification(userId);
  }

  @Get(":id/unread-count")  
  async getUnreadCount(@Param("id") userId: string): Promise<number>{
    return this.notificationService.getUnreadCount(userId);
  }

  @Put(":id/read")
  async markAsRead(@Param("id") id: string): Promise<Notification>{
    return this.notificationService.markAsRead(id);
  }

  @Delete(":id")
  async delete(@Param("id") id: string){
    return this.notificationService.delete(id);
  }
}