import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JlptWord } from './schemas/jlpt_word.schema';
import { Model } from 'mongoose';
import { CreateJlptWordDto } from './dto/create-jlpt-word.dto';

@Injectable()
export class JlptWordService {
    constructor(
        @InjectModel(JlptWord.name) private jlptWordModel: Model<JlptWord>,
    ) {}

    //Hàm tạo JlptWord
    async createJlptWord(createJlptWordDto: CreateJlptWordDto): Promise<JlptWord> {
        try {
            const existing = await this.jlptWordModel.findOne({ word: createJlptWordDto.word });
            if (existing) {
                throw new ConflictException('This word already exists');
            }
            const jlpt_word = new this.jlptWordModel(createJlptWordDto);
            return await jlpt_word.save();
        } catch (error) {
            throw new BadRequestException(`Failed to create word: ${error.message}`);
        }
    }

    async getDetailWord(word: string): Promise<any> {
        if (!word || typeof word !== 'string') {
            throw new BadRequestException('Invalid word parameter');
        }

        const result = await this.jlptWordModel.findOne({ word }).lean();
        if (!result) {
            throw new NotFoundException('This word does not exist');
        }

        return result;
    }


    async getJlptWordsPaginated(page = 1,limit = 10,level?: string,): 
        Promise<{
            data: {
            word: string;
            phonetic: string;
            meanings: string;
            }[];
            total: number;
            totalPages: number;
            currentPage: number;
        }> 
    {
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
                phonetic: (item.phonetic || []).join(' '),
                meanings: (item.meanings || [])
                .map((m) => m.meaning)
                .join(', '),
            }));

            return {
                data: formattedData,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
            };
        } catch (error) {
        throw new BadRequestException(`Failed to get JLPT words: ${error.message}`);
        }
    }

}
