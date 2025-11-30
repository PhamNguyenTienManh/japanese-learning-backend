import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationController } from './notifications.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notifications.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name: Notification.name, schema: NotificationSchema},
      {name: Profile.name, schema: ProfileSchema}
    ])
  ],
  providers: [NotificationsService],
  controllers: [NotificationController]
})
export class NotificationsModule {}
