import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserStreakHistory, UserStreakHistorySchema } from '../user_streak_history/schemas/user_streak_history.schema';
import { UserStudyDay, UserStudyDaySchema } from '../user_study_day/schemas/user_study_day.schema';
import { StatisticService } from './statistic.service';
import { StatisticController } from './statistic.controller';
import { ExamResult, ExamResultSchema } from '../exam_results/schemas/exam_results.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserStreakHistory.name, schema: UserStreakHistorySchema},
      { name: UserStudyDay.name, schema: UserStudyDaySchema },
      { name: ExamResult.name, schema: ExamResultSchema},
      { name: Profile.name, schema: ProfileSchema},
    ]),
  ],
  providers: [StatisticService],
  controllers: [StatisticController],
})
export class StatisticModule {}
