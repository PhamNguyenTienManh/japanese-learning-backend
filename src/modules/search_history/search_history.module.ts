import { Module } from '@nestjs/common';
import { SearchHistoryService } from './search_history.service';
import { SearchHistoryController } from './search_history.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchHistory, SearchHistorySchema } from './schemas/search_history.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {name: SearchHistory.name, schema: SearchHistorySchema}
      ])
      
    ],
  providers: [SearchHistoryService],
  controllers: [SearchHistoryController]
})
export class SearchHistoryModule {}
