import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JlptKanji } from '../modules/jlpt_kanji/schemas/jlpt_kanji.schema';
import { JLPT_KANJI_SEED } from './data/jlpt-kanji.data';

@Injectable()
export class JlptKanjiSeeder {
  constructor(
    @InjectModel(JlptKanji.name)
    private readonly kanjiModel: Model<JlptKanji>,
  ) {}

  async run() {
    console.log('🚀 Seeding JLPT Kanji...');

    // Xoá hết dữ liệu cũ (chỉ khi seed)
    await this.kanjiModel.deleteMany({});

    // Thêm dữ liệu mới
    await this.kanjiModel.insertMany(JLPT_KANJI_SEED);

    console.log('✔ JLPT Kanji seeding complete!');
  }
}
