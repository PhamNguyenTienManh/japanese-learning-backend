import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JlptWord } from "./schemas/jlpt_word.schema";
import { Model } from "mongoose";
import { CreateJlptWordDto } from "./dto/create-jlpt-word.dto";

@Injectable()
export class JlptWordService {
  constructor(
    @InjectModel(JlptWord.name) private jlptWordModel: Model<JlptWord>
  ) {}

  //Hàm tạo JlptWord
  async createJlptWord(
    createJlptWordDto: CreateJlptWordDto
  ): Promise<JlptWord> {
    try {
      const existing = await this.jlptWordModel.findOne({
        word: createJlptWordDto.word,
      });
      if (existing) {
        throw new ConflictException("This word already exists");
      }
      const jlpt_word = new this.jlptWordModel(createJlptWordDto);
      return await jlpt_word.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create word: ${error.message}`);
    }
  }

  async getDetailWord(word: string): Promise<any> {
    if (!word || typeof word !== "string") {
      throw new BadRequestException("Invalid word parameter");
    }

    const result = await this.jlptWordModel.findOne({ word }).lean();
    if (!result) {
      throw new NotFoundException("This word does not exist");
    }

    return result;
  }

  async getJlptWordsPaginated(
    page = 1,
    limit = 10,
    level?: string
  ): Promise<{
    data: {
      word: string;
      phonetic: string;
      meanings: string;
    }[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query: any = { isJlpt: true };
      if (level) {
        query.level = level;
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptWordModel
          .find(query, { word: 1, phonetic: 1, meanings: 1 })
          .skip(skip)
          .limit(limit)
          .lean(), // lean() giúp lấy plain object thay vì mongoose document
        this.jlptWordModel.countDocuments(query),
      ]);

      const formattedData = data.map((item) => ({
        word: item.word,
        phonetic: (item.phonetic || []).join(" "),
        meanings: (item.meanings || []).map((m) => m.meaning).join(", "),
      }));

      return {
        data: formattedData,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT words: ${error.message}`
      );
    }
  }

  async getJlptWordsForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ): Promise<{
    data: JlptWord[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const filter: any = {};
      // admin wants JLPT items only? nếu cần, giữ isJlpt true (giữ giống trước)
      filter.isJlpt = true;

      if (!includeDeleted) {
        filter.isDeleted = false;
      } // else includeDeleted=true -> no filter on isDeleted

      if (level) {
        filter.level = level;
      }

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        filter.$or = [
          { word: { $regex: qq, $options: "i" } },
          { phonetic: { $elemMatch: { $regex: qq, $options: "i" } } },
          { "meanings.meaning": { $regex: qq, $options: "i" } }, // search inside meanings array of objects
          { type: { $regex: qq, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        this.jlptWordModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.jlptWordModel.countDocuments(filter),
      ]);

      return {
        data: items as unknown as JlptWord[],
        total,
        totalPages: Math.ceil(total / Math.max(1, limit)) || 1,
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT words for admin: ${error.message}`
      );
    }
  }

  async updateJlptWord(id: string, data: Partial<CreateJlptWordDto>) {
    // normalize meanings if provided as string or array of strings
    const payload: any = { ...data };
    if (payload.meanings) {
      // if string -> split to array of objects
      if (typeof payload.meanings === "string") {
        payload.meanings = payload.meanings
          .split(",")
          .map((s) => ({ meaning: s.trim() }))
          .filter((m) => m.meaning);
      } else if (
        Array.isArray(payload.meanings) &&
        payload.meanings.length > 0
      ) {
        // if array of strings -> convert
        if (typeof payload.meanings[0] === "string") {
          payload.meanings = payload.meanings.map((s) => ({
            meaning: String(s).trim(),
          }));
        } // else assume already [{ meaning }]
      }
    }

    // phonetic normalization
    if (payload.phonetic && typeof payload.phonetic === "string") {
      payload.phonetic = payload.phonetic.split(/\s*,\s*|\s+/).filter(Boolean);
    }

    const updated = await this.jlptWordModel.findByIdAndUpdate(id, payload, {
      new: true,
    });
    if (!updated) throw new NotFoundException("Word not found");
    return updated;
  }

  async deleteJlptWord(id: string) {
    const doc = await this.jlptWordModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!doc) throw new NotFoundException("Word not found");
    return { message: "Deleted", id: doc._id };
  }
}
