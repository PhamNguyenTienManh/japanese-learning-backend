import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JlptKanji } from './schemas/jlpt_kanji.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateJlptKanjiDto } from './dto/create-jlpt-kanji.dto';

@Injectable()
export class JlptKanjiService {
    constructor(
        @InjectModel(JlptKanji.name) private jlptKanjiModel: Model<JlptKanji>,
    ) {}

    async createJlptKanji(data: CreateJlptKanjiDto): Promise<JlptKanji> {
        try {
        // kiểm tra tồn tại
        const existing = await this.jlptKanjiModel.findOne({ kanji: data.kanji });
        if (existing) {
            throw new ConflictException('This kanji already exists');
        }

        const kanji = new this.jlptKanjiModel(data);
        return await kanji.save();
        } catch (error) {
        throw new BadRequestException(`Failed to create kanji: ${error.message}`);
        }
    }

    async getDetailKanji(kanji: string): Promise<any> {
        if (!kanji || typeof kanji !== 'string') {
            throw new BadRequestException('Invalid word parameter');
        }

        const result = await this.jlptKanjiModel.findOne({ kanji }).lean();
        if (!result) {
            throw new NotFoundException('This word does not exist');
        }
        return result;
    }

    async getJlptKanjiPaginated(
        page = 1,
        limit = 10,
        level?: string,
        ) {
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

            const formatted = data.map(k => ({
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
            throw new BadRequestException(`Failed to get JLPT kanji: ${error.message}`,);
        }
    }

}
