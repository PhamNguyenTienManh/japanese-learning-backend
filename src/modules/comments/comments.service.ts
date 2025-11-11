import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Comment } from './schemas/comments.schema';
import { Model } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Max } from 'class-validator';

@Injectable()
export class CommentsService {

    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<Comment>
    ) { }
    async create(postId: string, dto: CreateCommentDto): Promise<Comment> {
        dto.postId = postId;
        const comment = new this.commentModel(dto);
        return comment.save();
    }

    async updateLiked(id: string, inc: boolean): Promise<Comment> {
        const comment = await this.commentModel.findById(id)
        if (!comment) throw new NotFoundException("Post not found")
        if (inc) comment.liked++;
        else comment.liked = Math.max(0, --comment.liked);
        return comment.updateOne(comment);
    }

    async update(commentId: string, dto: UpdateCommentDto): Promise<Comment> {
        const comment = await this.commentModel.findByIdAndUpdate(
            commentId,
            dto,
            { new: true },
        );
        if (!comment) {
            throw new NotFoundException('Comment not found');
        }
        return comment;
    }

}
