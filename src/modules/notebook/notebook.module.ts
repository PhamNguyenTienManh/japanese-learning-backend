import { Module } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import { NotebookController } from './notebook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Notebook, NotebookSchema } from './schemas/notebook.schema';

@Module({
  imports:[
    MongooseModule.forFeature([
      {name: Notebook.name, schema: NotebookSchema}
    ])
  ],
  providers: [NotebookService],
  controllers: [NotebookController]
})
export class NotebookModule {}
