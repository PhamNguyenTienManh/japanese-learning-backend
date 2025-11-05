import { Module } from '@nestjs/common';
import { ParCommentService } from './par_comment.service';
import { ParCommentController } from './par_comment.controller';

@Module({
  providers: [ParCommentService],
  controllers: [ParCommentController]
})
export class ParCommentModule {}
