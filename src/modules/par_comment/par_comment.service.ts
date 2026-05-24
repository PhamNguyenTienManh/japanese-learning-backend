import { Injectable, NotFoundException } from '@nestjs/common';
import { ParComment } from './schemas/par_comment.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateParCommentDto } from './dto/create-par_comment.dto';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class ParCommentService {
  constructor(
    @InjectModel(ParComment.name) private readonly parCommentModel: Model<ParComment>,
    private readonly moderationService: ModerationService,
  ) { }

  async create(commentId: string, dto: CreateParCommentDto): Promise<ParComment> {
    dto.commentId = commentId;
    const parComment = await new this.parCommentModel(dto).save();
    void this.moderationService
      .enqueueCreatedContent("reply_comment", String(parComment._id))
      .catch((error) =>
        console.error("Failed to enqueue reply moderation:", error),
      );
    return parComment;
  }

  async updateLiked(id: string, inc: boolean): Promise<ParComment> {
    const post = await this.parCommentModel.findById(id)
    if (!post) throw new NotFoundException("Comment not found")
    if (inc)
      post.liked++;
    else post.liked = Math.max(0, --post.liked);
    return post.updateOne(post);
  }
}
