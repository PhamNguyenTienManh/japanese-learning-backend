import { Controller, Post, Param, Body, Put } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../auth/public.decorator';
import { Comment } from './schemas/comments.schema';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('comments')
export class CommentsController {

    constructor(private readonly commentsService: CommentsService) { }

    @Public()
    @Post('posts/:postId')
    async create(@Param('postId') postId: string, @Body() dto: CreateCommentDto): Promise<Comment> {
        return this.commentsService.create(postId, dto);
    }

    @Put('liked/:id')
    @Public()
    async updateLiked(@Param('id') id: string, @Body('inc') inc: boolean): Promise<Comment> {
        return this.commentsService.updateLiked(id, inc);
    }


    @Put(':commentId')
    @Public()
    async update(
        @Param('commentId') commentId: string,
        @Body() dto: UpdateCommentDto,
    ): Promise<Comment> {
        return this.commentsService.update(commentId, dto);
    }
}
