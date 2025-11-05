import { Module } from '@nestjs/common';
import { UserWordsService } from './user_words.service';
import { UserWordsController } from './user_words.controller';

@Module({
  providers: [UserWordsService],
  controllers: [UserWordsController]
})
export class UserWordsModule {}
