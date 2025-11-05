import { Module } from '@nestjs/common';
import { NotebookItemService } from './notebook-item.service';
import { NotebookItemController } from './notebook-item.controller';

@Module({
  providers: [NotebookItemService],
  controllers: [NotebookItemController]
})
export class NotebookItemModule {}
