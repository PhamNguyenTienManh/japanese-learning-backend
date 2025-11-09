import { Module } from '@nestjs/common';
import { ExamsPartService } from './exams_part.service';
import { ExamsPartController } from './exams_part.controller';

@Module({
  providers: [ExamsPartService],
  controllers: [ExamsPartController]
})
export class ExamsPartModule {}
