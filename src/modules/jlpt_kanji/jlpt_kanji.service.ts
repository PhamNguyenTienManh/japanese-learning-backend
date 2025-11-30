import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JlptKanji } from "./schemas/jlpt_kanji.schema";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { CreateJlptKanjiDto } from "./dto/create-jlpt-kanji.dto";

@Injectable()
export class JlptKanjiService {
  constructor(
    @InjectModel(JlptKanji.name) private jlptKanjiModel: Model<JlptKanji>
  ) {}

  async createJlptKanji(data: CreateJlptKanjiDto): Promise<JlptKanji> {
    try {
      // kiểm tra tồn tại
      const existing = await this.jlptKanjiModel.findOne({ kanji: data.kanji });
      if (existing) {
        throw new ConflictException("This kanji already exists");
      }

      const kanji = new this.jlptKanjiModel(data);
      return await kanji.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create kanji: ${error.message}`);
    }
  }

  async getDetailKanji(kanji: string): Promise<any> {
    if (!kanji || typeof kanji !== "string") {
      throw new BadRequestException("Invalid word parameter");
    }

    const result = await this.jlptKanjiModel.findOne({ kanji }).lean();
    if (!result) {
      throw new NotFoundException("This word does not exist");
    }
    return result;
  }

  async getJlptKanjiPaginated(page = 1, limit = 10, level?: string) {
    try {
      const query: any = {};
      if (level) query.level = level;
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.jlptKanjiModel
          .find(query, { kanji: 1, mean: 1, kun: 1, on: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        this.jlptKanjiModel.countDocuments(query),
      ]);

      const formatted = data.map((k) => ({
        kanji: k.kanji,
        mean: k.mean,
        reading: `${k.kun || ""} ${k.on || ""}`.trim(),
      }));

      return {
        data: formatted,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT kanji: ${error.message}`
      );
    }
  }

  async getJlptKanjiForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ) {
    try {
      const filter: any = {};

      if (!includeDeleted) filter.isDeleted = false;
      if (level) filter.level = level;

      if (q && q.trim()) {
        const qq = q.trim();
        filter.$or = [
          { kanji: { $regex: qq, $options: "i" } },
          { mean: { $regex: qq, $options: "i" } },
          { detail: { $regex: qq, $options: "i" } },
          { kun: { $elemMatch: { $regex: qq, $options: "i" } } },
          { on: { $elemMatch: { $regex: qq, $options: "i" } } },
        ];
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptKanjiModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.jlptKanjiModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get kanji for admin: ${error.message}`
      );
    }
  }
  async updateJlptKanji(id: string, data: Partial<CreateJlptKanjiDto>) {
    const updated = await this.jlptKanjiModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updated) {
      throw new NotFoundException("Kanji not found");
    }

    return updated;
  }
  async deleteJlptKanji(id: string) {
    const deleted = await this.jlptKanjiModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      throw new NotFoundException("Kanji not found");
    }

    return { message: "Deleted", id };
  }
}
