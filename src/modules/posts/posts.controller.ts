import { Body, Controller, Param, Post, Put, } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Posts } from './schemas/posts.schema';
import { Public } from '../auth/public.decorator';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
    constructor(
        private readonly postService: PostsService
    ) { }

    @Public()
    @Post(':id')
    async create(@Param('id') id: string, @Body() dto: CreatePostDto): Promise<Posts> {
        return this.postService.create(id, dto);
    }

    @Put(':id')
    @Public()
    async update(@Param('id') id: string, @Body() dto: UpdatePostDto): Promise<Posts> {
        return this.postService.update(id, dto);
    }

    @Put('liked/:id')
    @Public()
    async updateLiked(@Param('id') id: string, @Body('inc') inc: boolean): Promise<Posts> {
        return this.postService.updateLiked(id, inc);
    }

    @Put('follow/:id')
    @Public()
    async updateFollow(@Param('id') id: string, @Body('inc') inc: boolean): Promise<Posts> {
        return this.postService.updateFollow(id, inc);
    }

}
