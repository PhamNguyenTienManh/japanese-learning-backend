import { Module } from '@nestjs/common';
import { JlptWordService } from './jlpt_word.service';
import { JlptWordController } from './jlpt_word.controller';

@Module({
  providers: [JlptWordService],
  controllers: [JlptWordController]
})
export class JlptWordModule {}
