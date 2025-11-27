import { Injectable, NotFoundException } from '@nestjs/common';
import { Posts } from './schemas/posts.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { object } from 'zod';
import { User } from '../users/schemas/user.schema';
import { Profile } from '../profiles/schemas/profiles.schema';

@Injectable()
export class PostsService {
    constructor(
        @InjectModel(Posts.name)
        private readonly postModel: Model<Posts>,

        @InjectModel(User.name)
        private readonly userModel: Model<User>,

        @InjectModel(Profile.name)
        private readonly profileModel: Model<Profile>,
    ) { }

    async create(id: string, dto: CreatePostDto): Promise<Posts> {
        
        const objectId = new Types.ObjectId(id);
        const profile = await this.profileModel.findOne({ userId: objectId });
        if (!profile) {
            throw new NotFoundException('Profile not found');
        }

        dto.profile_id = profile._id as Types.ObjectId;
        dto.category_id = typeof dto.category_id === 'string' ? new Types.ObjectId(dto.category_id) : dto.category_id;
        const post = new this.postModel(dto);
        return post.save();
    }

    async update(id: string, dto: UpdatePostDto): Promise<Posts> {
        const objectId = new Types.ObjectId(dto.category_id);
        dto.category_id = objectId;
        const post = await this.postModel.findById(id)
        if (!post) throw new NotFoundException("Post not found")

        return post.updateOne(dto);
    }

    async updateLiked(id: string, userId:string): Promise<Posts> {
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

    async getAll(page: number = 1, limit: number = 10): Promise<{ data: Posts[]; total: number; page: number; limit: number }> {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.postModel
                .find().populate("profile_id")
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.postModel.countDocuments().exec()
        ]);

        return {
            data,
            total,
            page,
            limit
        };
    }


    async getOne(id: string): Promise<Posts | null> {
        return this.postModel.findById(id).populate("profile_id");
    }

    async getStats() {
        const result: object[] = [];
        const totalPosts = await this.postModel.countDocuments();
        result.push({ totalPosts });

        const totalMembers = await this.userModel.countDocuments();
        result.push({ totalMembers });

        const like = await this.postModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalLikes: { $sum: '$liked' }
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
            ? { title: { $regex: query, $options: 'i' } }
            : {};

        const [items, total] = await Promise.all([
            this.postModel
                .find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),

            this.postModel.countDocuments(filter)
        ]);

        return {
            success: true,
            data: items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getPostsByCategory(category: string, page: number, limit: number) {
        const skip = (page - 1) * limit;

        const filter = category
            ? { categoryId: category }  // nhận categoryId từ FE gửi lên
            : {};

        const [items, total] = await Promise.all([
            this.postModel
                .find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('categoryId', 'name'), // chỉ lấy tên category
            this.postModel.countDocuments(filter)
        ]);

        return {
            success: true,
            data: items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async deleteOne(postId: string): Promise<Posts | null>{
        const objectId = new Types.ObjectId(postId);
        return this.postModel.findByIdAndDelete(objectId);
    }


}
