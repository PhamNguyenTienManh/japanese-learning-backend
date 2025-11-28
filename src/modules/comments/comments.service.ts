import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Comment } from './schemas/comments.schema';
import { Model, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Max } from 'class-validator';
import { Profile } from '../profiles/schemas/profiles.schema';

@Injectable()
export class CommentsService {

    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<Comment>,
        @InjectModel(Profile.name)
        private readonly profileModel: Model<Profile>
    ) { }
    async create(postId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
        dto.postId = new Types.ObjectId(postId);
        const objectId = new Types.ObjectId(userId);
        const profile = await this.profileModel.findOne({ userId: objectId })
        const profileId = profile?._id as Types.ObjectId;
        dto.profileId = profileId;
        const comment = new this.commentModel(dto);
        return comment.save();
    }

    async toggleLike(id: string, userId: string): Promise<Comment> {
        const objectId = new Types.ObjectId(userId);
        
        const comment = await this.commentModel.findById(id);
        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        if (!Array.isArray(comment.liked)) {
            comment.liked = [];
        }

        const index = comment.liked.findIndex(
            (idx) => idx.toString() === objectId.toString()
        );
        if (index === -1) {
            comment.liked.push(objectId);
        } else {
            comment.liked.splice(index, 1);
        }

        return comment.save();
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

    async getAllComment(id: string) {
        const objectId = new Types.ObjectId(id)
        const comment = await this.commentModel.find({ postId: objectId }).select("postId profileId content liked image createdAt").populate("profileId");
        return comment;
    }

    async delete(id:string): Promise<Comment | null>{
        return this.commentModel.findByIdAndDelete(id);
    }

}
