import { Module } from '@nestjs/common';
import { NotebookItemService } from './notebook-item.service';
import { NotebookItemController } from './notebook-item.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { NotebookItem, NotebookItemSchema } from './schemas/notebook-item.schema';
import { Notebook, NotebookSchema } from '../notebook/schemas/notebook.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name:NotebookItem.name, schema: NotebookItemSchema},
      {name: Notebook.name, schema: NotebookSchema}
    ])
  ],
  providers: [NotebookItemService],
  controllers: [NotebookItemController]
})
export class NotebookItemModule {}
