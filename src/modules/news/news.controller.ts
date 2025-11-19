import { Body, Controller, Get, Post } from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-new.dto';
import { News } from './schemas/news.schema';
import { Public } from '../auth/public.decorator';

@Controller('news')
export class NewsController {
    constructor(
        private readonly newService: NewsService
    ){}

    @Post()
    @Public()
    async create(@Body() dto: CreateNewsDto): Promise<News>{
        return this.newService.create(dto);
    }

    @Get()
    @Public()
    async getAll(): Promise<News[]>{
        return this.newService.get();
    }
}
