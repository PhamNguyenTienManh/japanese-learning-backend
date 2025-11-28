import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, } from '@nestjs/common';
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

    @Post()
    async create(@Req() req: any, @Body() dto: CreatePostDto): Promise<Posts> {
        console.log("dtoController", dto);
        
        const id = req?.user.sub;
        return this.postService.create(id, dto);
    }

    @Put(':id')
    @Public()
    async update(@Param('id') id: string, @Body() dto: UpdatePostDto): Promise<Posts> {
        return this.postService.update(id, dto);
    }

    @Put('liked/:id')
    async updateLiked(@Param('id') id: string, @Req() req: any): Promise<Posts> {
        const userId = req.user?.sub;
        return this.postService.updateLiked(id, userId);
    }

    @Put('follow/:id')
    @Public()
    async updateFollow(@Param('id') id: string, @Body('inc') inc: boolean): Promise<Posts> {
        return this.postService.updateFollow(id, inc);
    }

    @Get()
    @Public()
    async getAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10'
    ): Promise<{ data: Posts[]; total: number; page: number; limit: number; totalPage: number }> {
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        return this.postService.getAll(pageNumber, limitNumber);
    }

    @Get("/post/:id")
    @Public()
    async getOne(@Param("id") id: string): Promise<{data: Posts | null, countComment: number}> {
        return this.postService.getOne(id)
    }

    @Public()
    @Get("/stats")
    async getStats(): Promise<any> {
        return this.postService.getStats();
    }

    @Get('search')
    @Public()
    async searchPosts(
        @Query('q') q: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 5
    ) {
        return await this.postService.searchPosts(q, page, limit);
    }

    @Get("category")
    @Public()
    async getPostsByCategory(
        @Query('category') category: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 5
    ) {
        return await this.postService.getPostsByCategory(category, page, limit);
    }

    @Delete(":id")
    async deleteOne(@Param("id") id: string): Promise<Posts|null>{
        return this.postService.deleteOne(id);
    }



}
