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

      // Merge content object
      if (data.content) {
        updatePayload.content = {
          audio: data.content.audio ?? existing.content.audio,
          image: data.content.image ?? existing.content.image,
          textbody: data.content.textbody ?? existing.content.textbody,
          video: data.content.video ?? existing.content.video,
        };
      }

      const updated = await this.newsModel.findByIdAndUpdate(
        id,
        updatePayload,
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
