import { Module } from '@nestjs/common';
import { TrophiesService } from './trophies.service';
import { TrophiesController } from './trophies.controller';

@Module({
  providers: [TrophiesService],
  controllers: [TrophiesController],
})
export class TrophiesModule {}
