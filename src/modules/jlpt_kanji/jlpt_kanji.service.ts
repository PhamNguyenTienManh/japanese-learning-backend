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

    const result = await this.jlptKanjiModel
      .findOne({ kanji: kanji.trim(), isDeleted: { $ne: true } })
      .lean();
    if (!result) {
      throw new NotFoundException("This word does not exist");
    }

    return result;
  }

  async searchJlptKanji(q = "", limit = 20) {
    try {
      const safeQuery = String(q || "").trim();
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

      if (!safeQuery) {
        return {
          data: [],
          total: 0,
          totalPages: 0,
          currentPage: 1,
        };
      }

      const regex = new RegExp(this.escapeRegex(safeQuery), "i");
      const publicFilter = { isDeleted: { $ne: true } };
      const projection = {
        kanji: 1,
        mean: 1,
        detail: 1,
        examples: 1,
        example_kun: 1,
        example_on: 1,
        kun: 1,
        on: 1,
        stroke_count: 1,
        level: 1,
      };
      const searchFilter: any = {
        ...publicFilter,
        $or: [
          { kanji: regex },
          { mean: regex },
        ],
      };

      const exactMatch = await this.jlptKanjiModel
        .findOne({ ...publicFilter, kanji: safeQuery }, projection)
        .lean();
      const remainingLimit = exactMatch ? safeLimit - 1 : safeLimit;
      const [data, total] = await Promise.all([
        remainingLimit > 0
          ? this.jlptKanjiModel
              .find(
                exactMatch
                  ? { ...searchFilter, _id: { $ne: exactMatch._id } }
                  : searchFilter,
                projection
              )
              .sort({ level: 1, kanji: 1 })
              .limit(remainingLimit)
              .lean()
          : Promise.resolve([]),
        this.jlptKanjiModel.countDocuments(searchFilter),
      ]);

      const results = exactMatch ? [exactMatch, ...data] : data;

      return {
        data: results,
        total,
        totalPages: Math.ceil(total / safeLimit),
        currentPage: 1,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to search JLPT kanji: ${error.message}`
      );
    }
  }

  async getJlptKanjiPaginated(page = 1, limit = 10, level?: string) {
    try {
      const query: any = { isDeleted: { $ne: true } };
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

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getJlptKanjiForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ) {
    try {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const safeLevel = level && level !== "all" ? level : "";
      const safeQuery = q ? String(q).trim() : "";
      const filter: any = {};

      if (!includeDeleted) filter.isDeleted = false;
      if (safeLevel) filter.level = safeLevel;

      if (safeQuery) {
        filter.$or = [
          { kanji: { $regex: safeQuery, $options: "i" } },
          { mean: { $regex: safeQuery, $options: "i" } },
          { detail: { $regex: safeQuery, $options: "i" } },
          { kun: { $elemMatch: { $regex: safeQuery, $options: "i" } } },
          { on: { $elemMatch: { $regex: safeQuery, $options: "i" } } },
        ];
      }

      const skip = (safePage - 1) * safeLimit;

      const [data, total] = await Promise.all([
        this.jlptKanjiModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        this.jlptKanjiModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        currentPage: safePage,
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

  async getJlptKanjiForAdminById(id: string) {
    const kanji = await this.jlptKanjiModel.findById(id).lean();
    if (!kanji) {
      throw new NotFoundException("Kanji not found");
    }

    return kanji;
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
