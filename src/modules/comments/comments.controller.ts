import { Controller, Post, Param, Body, Put, Req, Get, Delete, Query, Patch } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../auth/public.decorator';
import { Comment } from './schemas/comments.schema';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('comments')
export class CommentsController {

    constructor(private readonly commentsService: CommentsService) { }

    @Post('posts/:postId')
    async create(@Param('postId') postId: string,@Req() req: any, @Body() dto: CreateCommentDto): Promise<Comment> {
        const userId = req.user?.sub;
        return this.commentsService.create(postId,userId, dto);
    }

    @Put('liked/:id')
    async updateLiked(@Param('id') id: string, @Req() req : any): Promise<Comment> {
        const userId = req.user?.sub;
        
        return this.commentsService.toggleLike(id, userId);
    }


    @Put(':commentId')
    async update(
        @Param('commentId') commentId: string,
        @Body() dto: UpdateCommentDto,
        @Req() req: any,
    ): Promise<Comment> {
        return this.commentsService.update(commentId, dto, req.user?.sub, req.user?.role);
    }

    @Get("admin")
    @Roles("admin")
    async getAllForAdmin(
        @Query("page") page: string = "1",
        @Query("limit") limit: string = "10",
        @Query("q") q: string = "",
        @Query("status") status: string = "active",
    ) {
        return this.commentsService.getAllForAdmin(
            parseInt(page, 10),
            parseInt(limit, 10),
            q,
            status,
        );
    }

    @Get("admin/:postId")
    @Roles("admin")
    async getAllCommentForAdmin(@Param("postId") postId: string) {
        return this.commentsService.getAllCommentForAdmin(postId);
    }

    @Patch("admin/:id/restore")
    @Roles("admin")
    async restoreOne(@Param("id") id: string, @Req() req: any): Promise<Comment | null> {
        return this.commentsService.restoreOne(id, req.user?.sub);
    }

    @Get(":id")
    @Public()
    async getAllComment(@Param("id") postId: string){
        return this.commentsService.getAllComment(postId);
    }

    @Delete(":id")
    async delete(@Param("id") id: string): Promise<Comment|null>{
        return this.commentsService.delete(id);
    }
}
