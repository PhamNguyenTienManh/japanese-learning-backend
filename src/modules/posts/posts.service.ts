import { Injectable, NotFoundException } from '@nestjs/common';
import { Posts } from './schemas/posts.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
    constructor(
        @InjectModel(Posts.name)
        private readonly postModel: Model<Posts>
    ) { }

    async create(id: string, dto: CreatePostDto): Promise<Posts> {
        dto.user_id = id;
        const post = new this.postModel(dto);
        return post.save();
    }

    async update(id: string, dto: UpdatePostDto): Promise<Posts> {
        const post = await this.postModel.findById(id)
        if (!post) throw new NotFoundException("Post not found")
        return post.updateOne(dto);
    }

    async updateLiked(id: string, inc: boolean): Promise<Posts> {
        const post = await this.postModel.findById(id)
        if (!post) throw new NotFoundException("Post not found")
        if (inc)
            post.liked++;
        else post.liked = Math.max(0, --post.liked);
        return post.updateOne(post);
    }


    async updateFollow(id: string, inc: boolean): Promise<Posts> {
        const post = await this.postModel.findById(id)
        if (!post) throw new NotFoundException("Post not found")
        if (inc)
            post.total_follow++;
        else post.total_follow = Math.max(0, --post.total_follow);
        return post.updateOne(post);
    }
}
