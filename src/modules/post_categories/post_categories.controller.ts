import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { PostCategoriesService } from './post_categories.service';
import { createPostCategoryDto } from './dto/create-post-category.dto';
import { PostCategory } from './schemas/post_categories.shema';
import { Public } from '../auth/public.decorator';
import { UpdatePostCategoryDto } from './dto/update-post-category.dto';

@Controller('post-categories')
export class PostCategoriesController {
    constructor(private readonly postCategoryService: PostCategoriesService){}

    @Public()
    @Post()
    async create(@Body() createPostCategoryDto: createPostCategoryDto) : Promise<PostCategory>{
        return this.postCategoryService.create(createPostCategoryDto);
    }

    @Public()
    @Put(':id')
    async update(@Param('id') id:string, @Body() dto:UpdatePostCategoryDto): Promise<PostCategory>{
        return this.postCategoryService.update(id, dto);
    }


}
