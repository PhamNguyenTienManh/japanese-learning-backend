import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  UserActivity,
  UserActivitySchema,
} from "./schemas/user_activity.schema";
import { UserActivitiesController } from "./user_activities.controller";
import { UserActivitiesService } from "./user_activities.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  providers: [UserActivitiesService],
  controllers: [UserActivitiesController],
  exports: [UserActivitiesService],
})
export class UserActivitiesModule {}
