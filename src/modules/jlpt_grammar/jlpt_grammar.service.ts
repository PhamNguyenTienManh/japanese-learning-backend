import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JlptGrammar } from "./schemas/jlpt_grammar.schema";
import { Model } from "mongoose";
import { CreateJlptGrammarDto } from "./dto/create-jlpt-grammar.dto";

@Injectable()
export class JlptGrammarService {
  constructor(
    @InjectModel(JlptGrammar.name) private jlptGrammarModel: Model<JlptGrammar>
  ) {}

  async createJlptGrammar(data: CreateJlptGrammarDto): Promise<JlptGrammar> {
    try {
      // Kiểm tra tồn tại theo title
      const existing = await this.jlptGrammarModel.findOne({
        title: data.title,
      });
      if (existing) {
        throw new ConflictException("This grammar already exists");
      }

      const grammar = new this.jlptGrammarModel(data);
      return await grammar.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create grammar: ${error.message}`
      );
    }
  }

  async getDetailGrammar(grammar: string): Promise<any> {
    if (!grammar || typeof grammar !== "string") {
      throw new BadRequestException("Invalid grammar parameter");
    }

    const result = await this.jlptGrammarModel
      .findOne({ title: grammar })
      .lean();
    if (!result) {
      throw new NotFoundException("This grammar does not exist");
    }
    return result;
  }

  async getJlptGrammarPaginated(
    page = 1,
    limit = 10,
    level?: string
  ): Promise<{
    data: {
      title: string;
      mean: string;
    }[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query: any = {};
      if (level) {
        query.level = level;
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptGrammarModel
          .find(query, { title: 1, mean: 1 })
          .skip(skip)
          .limit(limit)
          .lean(), // lean() giúp lấy plain object thay vì mongoose document
        this.jlptGrammarModel.countDocuments(query),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT grammar: ${error.message}`
      );
    }
  }
  async getGrammarForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ) {
    try {
      const filter: any = {};

      if (!includeDeleted) {
        filter.isDeleted = false;
      }

      if (level) {
        filter.level = level;
      }

      if (q && q.trim()) {
        const qq = q.trim();
        filter.$or = [
          { title: { $regex: qq, $options: "i" } },
          { mean: { $regex: qq, $options: "i" } },
          { detail: { $regex: qq, $options: "i" } },
          { examples: { $elemMatch: { $regex: qq, $options: "i" } } },
        ];
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptGrammarModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.jlptGrammarModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get grammar for admin: ${error.message}`
      );
    }
  }
  async updateGrammar(id: string, data: Partial<CreateJlptGrammarDto>) {
    const updated = await this.jlptGrammarModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updated) {
      throw new NotFoundException("Grammar not found");
    }

    return updated;
  }
  async deleteGrammar(id: string) {
    const deleted = await this.jlptGrammarModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      throw new NotFoundException("Grammar not found");
    }

    return { message: "Deleted", id };
  }
}
