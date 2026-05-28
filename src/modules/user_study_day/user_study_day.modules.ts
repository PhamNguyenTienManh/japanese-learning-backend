import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserStudyDay, UserStudyDaySchema } from './schemas/user_study_day.schema';
import { UserStudyDayService } from './user_study_day.service';
import { UserStudyDayController } from './user_study_day.controller';
import { UserActivitiesModule } from '../user_activities/user_activities.module';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStudyDay.name, schema: UserStudyDaySchema },
    ]),
    UserActivitiesModule,
  ],
  providers: [UserStudyDayService],
  controllers: [UserStudyDayController],
  exports: [UserStudyDayService],
})
export class UserStudyDayModule {}
