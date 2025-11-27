import { Controller, Post, Param, Body, Put, Req, Get } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../auth/public.decorator';
import { Comment } from './schemas/comments.schema';
import { UpdateCommentDto } from './dto/update-comment.dto';

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
    @Public()
    async update(
        @Param('commentId') commentId: string,
        @Body() dto: UpdateCommentDto,
    ): Promise<Comment> {
        return this.commentsService.update(commentId, dto);
    }

    @Get(":id")
    @Public()
    async getAllComment(@Param("id") postId: string){
        return this.commentsService.getAllComment(postId);
    }
}
