import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from './schemas/news.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name: News.name, schema: NewsSchema}
    ])
  ],
  providers: [NewsService],
  controllers: [NewsController]
})
export class NewsModule {}
