import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { News } from "./schemas/news.schema";
import { Model, Types } from "mongoose";
import { CreateNewsDto } from "./dto/create-new.dto";
import { UpdateNewsDto } from "./dto/update-new.dto";

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<News>
  ) {}

  async create(dto: CreateNewsDto): Promise<News> {
    const news = new this.newsModel(dto);
    return news.save();
  }

  async updateNews(id: string, data: UpdateNewsDto): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(id))
        throw new BadRequestException("Invalid news id");

      const existing = await this.newsModel.findById(id);
      if (!existing) {
        throw new NotFoundException("News not found");
      }

      const updatePayload: any = { ...data };

      // tránh cập nhật 1 field mất các field còn lại
      if (data.content) {
        updatePayload.content = {
          ...existing.content,
          ...data.content,
        };
      }

      const updated = await this.newsModel.findByIdAndUpdate(
        id,
        { $set: updatePayload },
        { new: true }
      );
      return {
        news: updated,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update news: ${error.message}`);
    }
  }

  async get(): Promise<News[]> {
    return this.newsModel.find();
  }
}
