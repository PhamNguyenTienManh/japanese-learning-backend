import { Module } from '@nestjs/common';
import { UserStreakHistoryService } from './user_streak_history.service';
import { UserStreakHistoryController } from './user_streak_history.controller';

@Module({
  providers: [UserStreakHistoryService],
  controllers: [UserStreakHistoryController]
})
export class UserStreakHistoryModule {}
