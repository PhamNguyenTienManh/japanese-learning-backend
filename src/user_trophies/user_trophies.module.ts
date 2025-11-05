import { Module } from '@nestjs/common';
import { UserTrophiesService } from './user_trophies.service';
import { UserTrophiesController } from './user_trophies.controller';

@Module({
  providers: [UserTrophiesService],
  controllers: [UserTrophiesController]
})
export class UserTrophiesModule {}
