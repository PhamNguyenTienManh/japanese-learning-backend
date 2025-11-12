import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { ParCommentService } from './par_comment.service';
import { Public } from '../auth/public.decorator';
import { CreateParCommentDto } from './dto/create-par_comment.dto';
import { ParComment } from './schemas/par_comment.schema';

@Controller('par-comment')
export class ParCommentController {
    constructor(
        private readonly parCommentService: ParCommentService
    ) { }

    @Public()
    @Post(':id')
    async create(@Param() id: string, @Body() dto: CreateParCommentDto): Promise<ParComment> {
        return this.parCommentService.create(id, dto)
    }

    @Put('liked/:id')
    @Public()
    async updateLiked(@Param('id') id: string, @Body('inc') inc: boolean): Promise<ParComment> {
        return this.parCommentService.updateLiked(id, inc);
    }
}
