import { Module } from '@nestjs/common';
import { NotebookItemService } from './notebook-item.service';
import { NotebookItemController } from './notebook-item.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { NotebookItem, NotebookItemSchema } from './schemas/notebook-item.schema';
import { Notebook, NotebookSchema } from '../notebook/schemas/notebook.schema';
import { UserActivitiesModule } from '../user_activities/user_activities.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name:NotebookItem.name, schema: NotebookItemSchema},
      {name: Notebook.name, schema: NotebookSchema}
    ]),
    UserActivitiesModule,
  ],
  providers: [NotebookItemService],
  controllers: [NotebookItemController],
  exports: [NotebookItemService],
})
export class NotebookItemModule {}
