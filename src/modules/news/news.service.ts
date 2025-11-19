import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { News } from './schemas/news.schema';
import { privateDecrypt } from 'crypto';
import { Model } from 'mongoose';
import { CreateNewsDto } from './dto/create-new.dto';

@Injectable()
export class NewsService {
    constructor(
        @InjectModel(News.name)
        private readonly newsModel: Model<News>
    ){}

    async create(dto: CreateNewsDto): Promise<News>{
        const news =new this.newsModel(dto);
        return news.save();
    }

    async get(): Promise<News[]>{
        return this.newsModel.find();
    }
}
