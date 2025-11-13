import { Module } from '@nestjs/common';
import { ExamsPartService } from './exams_part.service';
import { ExamsPartController } from './exams_part.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamPart, ExamPartSchema } from './schema/exams_part.schema';

@Module({
  imports: [
          MongooseModule.forFeature([{ name: ExamPart.name, schema: ExamPartSchema }]),
          
    ],
  providers: [ExamsPartService],
  controllers: [ExamsPartController]
})
export class ExamsPartModule {}
