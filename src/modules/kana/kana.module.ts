import { Module } from '@nestjs/common';
import { KanaController } from './kana.controller';
import { KanaService } from './kana.service';

@Module({
  controllers: [KanaController],
  providers: [KanaService],
})
export class KanaModule {}
