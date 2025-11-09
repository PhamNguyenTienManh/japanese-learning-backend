import { Module } from '@nestjs/common';
import { SearchHistoryService } from './search_history.service';
import { SearchHistoryController } from './search_history.controller';

@Module({
  providers: [SearchHistoryService],
  controllers: [SearchHistoryController]
})
export class SearchHistoryModule {}
