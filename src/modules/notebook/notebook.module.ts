import { Module } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import { NotebookController } from './notebook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Notebook, NotebookSchema } from './schemas/notebook.schema';
import { UserActivitiesModule } from '../user_activities/user_activities.module';

@Module({
  imports:[
    MongooseModule.forFeature([
      {name: Notebook.name, schema: NotebookSchema}
    ]),
    UserActivitiesModule,
  ],
  providers: [NotebookService],
  controllers: [NotebookController],
  exports: [NotebookService],
})
export class NotebookModule {}
