import { Module } from '@nestjs/common';
import { ParCommentService } from './par_comment.service';
import { ParCommentController } from './par_comment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ParComment, ParCommentSchema } from './schemas/par_comment.schema';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
      MongooseModule.forFeature([
        {name: ParComment.name, schema: ParCommentSchema}
      ]),
      ModerationModule,
    ],
  providers: [ParCommentService],
  controllers: [ParCommentController]
})
export class ParCommentModule {}
