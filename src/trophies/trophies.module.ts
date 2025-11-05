import { Module } from '@nestjs/common';
import { TrophiesService } from './trophies.service';
import { TrophiesController } from './trophies.controller';
import { UserModule } from './user_/user_.module';

@Module({
  providers: [TrophiesService],
  controllers: [TrophiesController],
  imports: [UserModule]
})
export class TrophiesModule {}
