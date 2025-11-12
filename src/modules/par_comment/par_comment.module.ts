import { Module } from '@nestjs/common';
import { ParCommentService } from './par_comment.service';
import { ParCommentController } from './par_comment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ParComment, ParCommentSchema } from './schemas/par_comment.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {name: ParComment.name, schema: ParCommentSchema}
      ])
    ],
  providers: [ParCommentService],
  controllers: [ParCommentController]
})
export class ParCommentModule {}
