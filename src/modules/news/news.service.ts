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

  private toObjectId(id: string, label = "id"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return new Types.ObjectId(id);
  }

  private serializeNews(news: any, userId?: string): any {
    const item = typeof news?.toObject === "function" ? news.toObject() : news;
    const liked = Array.isArray(item?.liked) ? item.liked : [];
    const viewedBy = Array.isArray(item?.viewedBy) ? item.viewedBy : [];
    const currentUserId = userId ? String(userId) : "";

    return {
      ...item,
      likeCount: liked.length,
      viewCount: item?.viewCount ?? 0,
      isLiked: currentUserId
        ? liked.some((id) => String(id) === currentUserId)
        : false,
      isViewed: currentUserId
        ? viewedBy.some((id) => String(id) === currentUserId)
        : false,
      liked: undefined,
      viewedBy: undefined,
    };
  }

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
          syncData: data.content.syncData ?? existing.content.video,
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

  async get(): Promise<any[]> {
    const news = await this.newsModel.find().sort({ dateField: -1 }).lean();
    return news.map((item) => this.serializeNews(item));
  }

  async getMyEngagement(userId: string): Promise<{
    likedIds: string[];
    viewedIds: string[];
  }> {
    const objectId = this.toObjectId(userId, "user id");
    const [liked, viewed] = await Promise.all([
      this.newsModel.find({ liked: objectId }).select("_id").lean(),
      this.newsModel.find({ viewedBy: objectId }).select("_id").lean(),
    ]);

    return {
      likedIds: liked.map((item) => String(item._id)),
      viewedIds: viewed.map((item) => String(item._id)),
    };
  }

  async toggleFavorite(id: string, userId: string): Promise<{
    id: string;
    liked: boolean;
    likeCount: number;
  }> {
    const newsId = this.toObjectId(id, "news id");
    const userObjectId = this.toObjectId(userId, "user id");
    const news = await this.newsModel.findById(newsId);

    if (!news) {
      throw new NotFoundException("News not found");
    }

    if (!Array.isArray(news.liked)) {
      news.liked = [];
    }

    const index = news.liked.findIndex(
      (likedUserId) => String(likedUserId) === String(userObjectId)
    );
    const liked = index === -1;

    if (liked) {
      news.liked.push(userObjectId);
    } else {
      news.liked.splice(index, 1);
    }

    await news.save();

    return {
      id: String(news._id),
      liked,
      likeCount: news.liked.length,
    };
  }

  async markViewed(id: string, userId?: string): Promise<{
    id: string;
    viewed: boolean;
    viewCount: number;
  }> {
    const newsId = this.toObjectId(id, "news id");

    if (!userId) {
      const updated = await this.newsModel
        .findByIdAndUpdate(
          newsId,
          { $inc: { viewCount: 1 } },
          { new: true }
        )
        .select("viewCount");

      if (!updated) {
        throw new NotFoundException("News not found");
      }

      return {
        id: String(updated._id),
        viewed: false,
        viewCount: updated.viewCount ?? 0,
      };
    }

    const userObjectId = this.toObjectId(userId, "user id");
    const news = await this.newsModel.findById(newsId);

    if (!news) {
      throw new NotFoundException("News not found");
    }

    if (!Array.isArray(news.viewedBy)) {
      news.viewedBy = [];
    }

    const hasViewed = news.viewedBy.some(
      (viewedUserId) => String(viewedUserId) === String(userObjectId)
    );

    if (!hasViewed) {
      news.viewedBy.push(userObjectId);
      news.viewCount = (news.viewCount ?? 0) + 1;
      await news.save();
    }

    return {
      id: String(news._id),
      viewed: true,
      viewCount: news.viewCount ?? 0,
    };
  }
}
