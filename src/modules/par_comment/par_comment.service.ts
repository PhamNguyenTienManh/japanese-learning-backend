import { Injectable } from '@nestjs/common';
import { ParComment } from './schemas/par_comment.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateParCommentDto } from './dto/create-par_comment.dto';

@Injectable()
export class ParCommentService {
    constructor(
    @InjectModel(ParComment.name) private readonly parCommentModel: Model<ParComment>,
  ) {}

  async create(commentId: string, dto: CreateParCommentDto): Promise<ParComment> {
    dto.commentId = commentId;
    const parComment = new this.parCommentModel(dto);
    return parComment.save();
  }
}
