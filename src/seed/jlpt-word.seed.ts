import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JlptWord } from '../modules/jlpt_word/schemas/jlpt_word.schema';
import { JLPT_WORDS } from './data/jlpt-word.data';

@Injectable()
export class JlptWordSeeder {
  constructor(
    @InjectModel(JlptWord.name)
    private readonly jlptModel: Model<JlptWord>,
  ) {}

  async run() {
    console.log('🚀 Seeding JLPT words...');

    // Xóa toàn bộ dữ liệu cũ
    await this.jlptModel.deleteMany({});

    // Lọc các từ duy nhất theo 'word'
    const uniqueWords = Array.from(
      new Map(JLPT_WORDS.map(item => [item.word, item])).values()
    );

    // Insert dữ liệu đã lọc
    await this.jlptModel.insertMany(uniqueWords);

    console.log(`✔ JLPT word seeding complete! Inserted ${uniqueWords.length} words.`);
  }
}
