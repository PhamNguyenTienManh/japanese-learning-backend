import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserStudyDay, UserStudyDaySchema } from './schemas/user_study_day.schema';
import { UserStudyDayService } from './user_study_day.service';
import { UserStudyDayController } from './user_study_day.controller';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStudyDay.name, schema: UserStudyDaySchema },
    ]),
  ],
  providers: [UserStudyDayService],
  controllers: [UserStudyDayController],
  exports: [UserStudyDayService],
})
export class UserStudyDayModule {}
