import { Module } from '@nestjs/common';
import { UserStreaksService } from './user_streaks.service';
import { UserStreaksController } from './user_streaks.controller';

@Module({
  providers: [UserStreaksService],
  controllers: [UserStreaksController]
})
export class UserStreaksModule {}
