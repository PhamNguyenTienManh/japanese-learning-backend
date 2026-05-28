import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Comment } from './schemas/comments.schema';
import { Model, Types } from 'mongoose';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Profile } from '../profiles/schemas/profiles.schema';
import { ModerationService } from '../moderation/moderation.service';
import { UserActivitiesService } from '../user_activities/user_activities.service';
import {
    UserActivityTargetType,
    UserActivityType,
} from '../user_activities/schemas/user_activity.schema';
import { Posts } from '../posts/schemas/posts.schema';

@Injectable()
export class CommentsService {

    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<Comment>,
        @InjectModel(Profile.name)
        private readonly profileModel: Model<Profile>,
        @InjectModel(Posts.name)
        private readonly postModel: Model<Posts>,
        private readonly moderationService: ModerationService,
        private readonly userActivitiesService: UserActivitiesService,
    ) { }
    async create(postId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
        dto.postId = new Types.ObjectId(postId);
        const objectId = new Types.ObjectId(userId);
        const profile = await this.profileModel.findOne({ userId: objectId })
        const profileId = profile?._id as Types.ObjectId;
        dto.profileId = profileId;
        const comment = await new this.commentModel(dto).save();
        this.userActivitiesService.createSafely({
            userId,
            type: UserActivityType.COMMENT_CREATED,
            title: "Đã bình luận trong một bài viết",
            targetType: UserActivityTargetType.POST,
            targetId: dto.postId,
            metadata: {
                commentId: String(comment._id),
            },
        }, "Failed to create comment activity:");
        void this.moderationService
            .enqueueCreatedContent("comment", String(comment._id))
            .catch((error) =>
                console.error("Failed to enqueue comment moderation:", error),
            );
        return comment;
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

    async update(commentId: string, dto: UpdateCommentDto, userId?: string, role?: string): Promise<Comment> {
        if (!Types.ObjectId.isValid(commentId)) {
            throw new BadRequestException('Comment id không hợp lệ.');
        }

        const comment = await this.commentModel.findById(commentId);
        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        const isAdmin = role === 'admin';
        const isDeleted = comment.isDeleted === true || Number(comment.status) === 0;

        if (isDeleted && !isAdmin) {
            throw new ForbiddenException('Bình luận của bạn đã bị xóa do vi phạm nên không thể chỉnh sửa.');
        }

        if (!isAdmin) {
            if (!userId || !Types.ObjectId.isValid(userId)) {
                throw new ForbiddenException('Bạn không có quyền chỉnh sửa bình luận này.');
            }

            const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) });
            if (!profile || String(profile._id) !== String(comment.profileId)) {
                throw new ForbiddenException('Bạn không có quyền chỉnh sửa bình luận này.');
            }
        }

        const updatedComment = await this.commentModel.findByIdAndUpdate(
            commentId,
            { ...dto, edited_at: new Date() },
            { new: true },
        );
        if (!updatedComment) {
            throw new NotFoundException('Comment not found');
        }
        return updatedComment;
    }

    async getAllCommentForAdmin(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Post id không hợp lệ.');
        }

        const objectId = new Types.ObjectId(id)
        const comment = await this.commentModel
            .find({ postId: objectId })
            .select("postId profileId content liked image createdAt edited_at isDeleted status")
            .populate("profileId");
        return comment;
    }

    async getAllForAdmin(
        page: number = 1,
        limit: number = 10,
        query: string = '',
        status: string = 'active',
    ) {
        const safePage = Math.max(Number(page) || 1, 1);
        const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
        const skip = (safePage - 1) * safeLimit;
        const filter: any = {};

        if (query?.trim()) {
            filter.content = { $regex: query.trim(), $options: 'i' };
        }

        if (status === 'deleted') {
            filter.$or = [{ isDeleted: true }, { status: 0 }];
        } else if (status === 'all') {
            // Admin can audit both active and deleted comments.
        } else {
            filter.isDeleted = { $ne: true };
            filter.status = { $ne: 0 };
        }

        const [comments, total] = await Promise.all([
            this.commentModel
                .find(filter)
                .select("postId profileId content liked image createdAt edited_at isDeleted status")
                .populate("profileId")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean<any[]>(),
            this.commentModel.countDocuments(filter),
        ]);

        const postIds = [
            ...new Set(
                comments
                    .map((comment) => comment.postId)
                    .filter(Boolean)
                    .map((postId) => String(postId)),
            ),
        ];
        const posts = await this.postModel
            .find({ _id: { $in: postIds.map((postId) => new Types.ObjectId(postId)) } })
            .select("title status isDeleted")
            .lean<any[]>();
        const postMap = new Map(posts.map((post) => [String(post._id), post]));

        return {
            data: comments.map((comment) => ({
                ...comment,
                postId: postMap.get(String(comment.postId)) || comment.postId,
            })),
            total,
            page: safePage,
            limit: safeLimit,
            totalPage: Math.max(Math.ceil(total / safeLimit), 1),
        };
    }

    async getAllComment(id: string) {
        const objectId = new Types.ObjectId(id)
        const comment = await this.commentModel.find({ postId: objectId, isDeleted: { $ne: true }, status: { $ne: 0 } }).select("postId profileId content liked image createdAt edited_at").populate("profileId");
        return comment;
    }

    async delete(id:string): Promise<Comment | null>{
        return this.commentModel.findByIdAndUpdate(
            id,
            { $set: { isDeleted: true, status: 0 } },
            { new: true },
        );
    }

    async restoreOne(commentId: string, restoredBy?: string): Promise<Comment | null> {
        if (!Types.ObjectId.isValid(commentId)) {
            throw new BadRequestException('Comment id không hợp lệ.');
        }

        await this.moderationService.restoreCommentByTarget(commentId, restoredBy);

        const restoredComment = await this.commentModel.findByIdAndUpdate(
            commentId,
            { $set: { isDeleted: false, status: 1 } },
            { new: true },
        );

        if (!restoredComment) {
            throw new NotFoundException('Comment not found');
        }

        return restoredComment;
    }

}
