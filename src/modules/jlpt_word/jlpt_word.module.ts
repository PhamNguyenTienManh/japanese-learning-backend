import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptWordService } from './jlpt_word.service';
import { JlptWordController } from './jlpt_word.controller';
import { JlptWord, JlptWordSchema } from './schemas/jlpt_word.schema';

@Module({
  imports: [
      MongooseModule.forFeature([{ name: JlptWord.name, schema: JlptWordSchema }])
  ],
  providers: [JlptWordService],
  controllers: [JlptWordController]
})
export class JlptWordModule {}
