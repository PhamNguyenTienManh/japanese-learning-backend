import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JlptGrammar } from '../modules/jlpt_grammar/schemas/jlpt_grammar.schema';
import { GRAMMAR_DATA } from './data/grammar.data';

@Injectable()
export class JlptGrammarSeeder {
  constructor(
    @InjectModel(JlptGrammar.name)
    private readonly grammarModel: Model<JlptGrammar>,
  ) {}

  async run() {
    console.log('🚀 Seeding JLPT Grammar...');

    // Xoá hết (chỉ khi seed)
    await this.grammarModel.deleteMany({});

    // Thêm mới
    await this.grammarModel.insertMany(GRAMMAR_DATA);

    console.log('✔ JLPT Grammar seeding complete!');
  }
}
