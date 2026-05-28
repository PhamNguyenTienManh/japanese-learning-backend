import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Posts } from './schemas/posts.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { User } from '../users/schemas/user.schema';
import { Profile } from '../profiles/schemas/profiles.schema';
import { Comment } from '../comments/schemas/comments.schema';
import { UploadService } from '../upload/upload.service';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class PostsService {
    constructor(
        @InjectModel(Posts.name)
        private readonly postModel: Model<Posts>,

        @InjectModel(User.name)
        private readonly userModel: Model<User>,

        @InjectModel(Profile.name)
        private readonly profileModel: Model<Profile>,

        @InjectModel(Comment.name)
        private readonly commentModel: Model<Comment>,

        private readonly uploadService: UploadService,
        private readonly moderationService: ModerationService,
    ) { }

    private readonly activePostFilter = { status: 1, isDeleted: { $ne: true } };

    async create(id: string, dto: CreatePostDto): Promise<Posts> {
        const objectId = new Types.ObjectId(id);
        const profile = await this.profileModel.findOne({ userId: objectId });
        if (!profile) {
            throw new NotFoundException('Profile not found');
        }

        dto.profile_id = profile._id as Types.ObjectId;
        dto.category_id = typeof dto.category_id === 'string' ? new Types.ObjectId(dto.category_id) : dto.category_id;

        const post = await new this.postModel(dto).save();
        void this.moderationService
            .enqueueCreatedContent("post", String(post._id))
            .catch((error) =>
                console.error("Failed to enqueue post moderation:", error),
            );
        return post;
    }

    async update(id: string, dto: UpdatePostDto): Promise<Posts> {
        const post = await this.postModel.findById(id);
        if (!post) throw new NotFoundException("Post not found");

        // Nếu có category_id trong dto, convert sang ObjectId
        if (dto.category_id) {
            dto.category_id = typeof dto.category_id === 'string'
                ? new Types.ObjectId(dto.category_id)
                : dto.category_id;
        }
        (dto as any).edited_at = new Date();

        // Xử lý xóa ảnh cũ nếu ảnh mới được upload hoặc ảnh bị xóa
        if (dto.image_url === null && post.image_publicId) {
            // User muốn xóa ảnh
            try {
                await this.uploadService.deleteImage(post.image_publicId);
            } catch (error) {
                console.error('Failed to delete old image:', error);
            }
        } else if (dto.image_url && dto.image_publicId && post.image_publicId && dto.image_publicId !== post.image_publicId) {
            // Ảnh mới được upload, xóa ảnh cũ
            try {
                await this.uploadService.deleteImage(post.image_publicId);
            } catch (error) {
                console.error('Failed to delete old image:', error);
            }
        }

        await post.updateOne(dto);
        const updatedPost = await this.postModel.findById(id);
        if (!updatedPost) throw new NotFoundException("Post not found");
        return updatedPost;
    }

    async updateLiked(id: string, userId: string): Promise<Posts> {
        const objectId = new Types.ObjectId(userId);

        const post = await this.postModel.findById(id);
        if (!post) {
            throw new NotFoundException('post not found');
        }

        if (!Array.isArray(post.liked)) {
            post.liked = [];
        }

        const index = post.liked.findIndex(
            (idx) => idx.toString() === objectId.toString()
        );
        if (index === -1) {
            post.liked.push(objectId);
        } else {
            post.liked.splice(index, 1);
        }

        return post.save();
    }

    async updateFollow(id: string, inc: boolean): Promise<Posts> {
        const post = await this.postModel.findById(id)
        if (!post) throw new NotFoundException("Post not found")
        if (inc)
            post.total_follow++;
        else post.total_follow = Math.max(0, --post.total_follow);
        return post.updateOne(post);
    }

    async getAll(page: number = 1, limit: number = 10): Promise<{ data: Posts[]; countComment: any[], total: number; page: number; limit: number; totalPage: number }> {
        const skip = (page - 1) * limit;
        const filter = this.activePostFilter;
        const [data, total, countComment] = await Promise.all([
            this.postModel
                .find(filter).populate("profile_id")
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit).populate("category_id")
                .exec(),
            this.postModel.countDocuments(filter).exec(),
            this.commentModel.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: "$postId",
                        totalComment: { $sum: 1 }
                    }
                }
            ])
        ]);
        const totalPage = Math.ceil(total / limit);

        return {
            data,
            countComment,
            total,
            page,
            limit,
            totalPage
        };
    }

    async getOne(id: string): Promise<{ data: Posts | null, countComment: number }> {
        const objectId = new Types.ObjectId(id);
        const [data, countComment] = await Promise.all([
            this.postModel.findOne({ _id: objectId, ...this.activePostFilter }).populate("profile_id").populate("category_id", "name"),
            this.commentModel.countDocuments({ postId: objectId, isDeleted: { $ne: true } })
        ])
        return {
            data, countComment
        }
    }

    async getOneAccessible(
        id: string,
        userId: string,
        role?: string,
    ): Promise<{ data: Posts | null, countComment: number }> {
        const objectId = new Types.ObjectId(id);
        const post = await this.postModel
            .findById(objectId)
            .populate("profile_id")
            .populate("category_id", "name");

        if (!post) {
            return { data: null, countComment: 0 };
        }

        const postData: any = post;
        const ownerUserId = postData.profile_id?.userId
            ? String(postData.profile_id.userId)
            : "";
        const isActivePost =
            Number(postData.status) === 1 && postData.isDeleted !== true;
        const canViewHidden =
            isActivePost ||
            role === "admin" ||
            (userId && ownerUserId === String(userId));

        if (!canViewHidden) {
            return { data: null, countComment: 0 };
        }

        const countComment = await this.commentModel.countDocuments({
            postId: objectId,
            isDeleted: { $ne: true },
        });

        return { data: post, countComment };
    }

    async getOneForAdmin(id: string): Promise<{ data: Posts | null, countComment: number }> {
        const objectId = new Types.ObjectId(id);
        const [data, countComment] = await Promise.all([
            this.postModel.findById(objectId).populate("profile_id").populate("category_id", "name"),
            this.commentModel.countDocuments({ postId: objectId, isDeleted: { $ne: true } })
        ])

        return {
            data, countComment
        }
    }

    async getStats() {
        const result: object[] = [];
        const totalPosts = await this.postModel.countDocuments(this.activePostFilter);
        result.push({ totalPosts });

        const totalMembers = await this.userModel.countDocuments();
        result.push({ totalMembers });

        const like = await this.postModel.aggregate([
            {
                $match: this.activePostFilter
            },
            {
                $project: {
                    likedCount: { $size: "$liked" }
                }
            },
            {
                $group: {
                    _id: null,
                    totalLikes: { $sum: "$likedCount" }
                }
            }
        ]);

        const totalLikes = like[0]?.totalLikes ?? 0;

        result.push({ totalLikes });
        result.push({ totalViews: 16 })
        const merged = Object.assign({}, ...result);

        return merged;
    }

    async searchPosts(query: string, page: number, limit: number) {
        const skip = (page - 1) * limit;

        const filter = query
            ? { title: { $regex: query, $options: 'i' }, ...this.activePostFilter }
            : this.activePostFilter;

        const [items, total, countComment] = await Promise.all([
            this.postModel
                .find(filter)
                .skip(skip)
                .limit(limit).populate("category_id").populate("profile_id")
                .sort({ createdAt: -1 }),

            this.postModel.countDocuments(filter),
            this.commentModel.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: "$postId",
                        totalComment: { $sum: 1 }
                    }
                }
            ])
        ]);

        return {
            success: true,
            data: items,
            countComment: countComment,
            total,
            page,
            limit,
            totalPage: Math.ceil(total / limit)
        };
    }

    async getPostsByCategory(category: string, page: number, limit: number) {
        const objectId = new Types.ObjectId(category)
        const skip = (page - 1) * limit;

        const filter = category
            ? { category_id: objectId, ...this.activePostFilter }
            : this.activePostFilter;

        const [items, total, countComment] = await Promise.all([
            this.postModel
                .find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('category_id', 'name')
                .populate("profile_id", "name image_url"),

            this.postModel.countDocuments(filter),
            this.commentModel.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: "$postId",
                        totalComment: { $sum: 1 }
                    }
                }
            ])
        ]);

        return {
            success: true,
            data: items,
            countComment: countComment,
            total,
            page,
            limit,
            totalPage: Math.ceil(total / limit)
        };
    }

    async getAllForAdmin(
        page: number = 1,
        limit: number = 10,
        query: string = '',
        category: string = 'all',
        status: string = 'active',
    ): Promise<{ data: Posts[]; countComment: any[], total: number; page: number; limit: number; totalPage: number }> {
        const safePage = Math.max(Number(page) || 1, 1);
        const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
        const skip = (safePage - 1) * safeLimit;
        const filter: any = {};

        if (query?.trim()) {
            filter.title = { $regex: query.trim(), $options: 'i' };
        }

        if (category && category !== 'all') {
            filter.category_id = new Types.ObjectId(category);
        }

        if (status === 'deleted') {
            filter.$or = [{ isDeleted: true }, { status: 0 }];
        } else if (status === 'all') {
            // No status constraint: admin can audit both active and deleted posts.
        } else {
            Object.assign(filter, this.activePostFilter);
        }

        const [data, total, countComment] = await Promise.all([
            this.postModel
                .find(filter)
                .populate("profile_id")
                .populate("category_id")
                .sort({ created_at: -1, _id: -1 })
                .skip(skip)
                .limit(safeLimit)
                .exec(),
            this.postModel.countDocuments(filter).exec(),
            this.commentModel.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: "$postId",
                        totalComment: { $sum: 1 }
                    }
                }
            ])
        ]);

        return {
            data,
            countComment,
            total,
            page: safePage,
            limit: safeLimit,
            totalPage: Math.max(Math.ceil(total / safeLimit), 1)
        };
    }

    async deleteOne(postId: string, deletedBy?: string): Promise<Posts | null> {
        const update: any = {
            status: 0,
            isDeleted: true,
            deleted_at: new Date(),
        };

        if (deletedBy) {
            update.deleted_by = new Types.ObjectId(deletedBy);
        }

        return this.postModel.findByIdAndUpdate(
            postId,
            {
                $set: update
            },
            {
                new: true
            }
        );
    }

    async restoreOne(postId: string, restoredBy?: string): Promise<Posts | null> {
        if (!Types.ObjectId.isValid(postId)) {
            throw new BadRequestException("Post id không hợp lệ.");
        }

        await this.moderationService.restorePostByTarget(postId, restoredBy);

        const restoredPost = await this.postModel.findByIdAndUpdate(
            postId,
            {
                $set: {
                    status: 1,
                    isDeleted: false,
                    deleted_at: null,
                    deleted_by: null,
                }
            },
            {
                new: true
            }
        );

        if (!restoredPost) {
            throw new NotFoundException("Post not found");
        }

        return restoredPost;
    }

}
