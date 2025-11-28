import { Module } from '@nestjs/common';
import { UserStreakHistoryService } from './user_streak_history.service';
import { UserStreakHistoryController } from './user_streak_history.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { UserStreakHistory, UserStreakHistorySchema } from './schemas/user_streak_history.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        { name: UserStreakHistory.name, schema: UserStreakHistorySchema },
      ])
    ],
  providers: [UserStreakHistoryService],
  controllers: [UserStreakHistoryController]
})
export class UserStreakHistoryModule {}
