import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JlptWordSeeder } from './jlpt-word.seed';
import { JlptWordMaziiSeeder } from './jlpt-word-mazii.seed';
import { JlptGrammarSeeder } from './jlpt-grammar.seed';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptWord, JlptWordSchema } from '../modules/jlpt_word/schemas/jlpt_word.schema';
import { JlptGrammar, JlptGrammarSchema } from '../modules/jlpt_grammar/schemas/jlpt_grammar.schema';
import { JlptKanjiSeeder } from './jlpt-kanji.seed';
import { JlptKanjiMaziiSeeder } from './jlpt-kanji-mazii.seed';
import { JlptKanji, JlptKanjiSchema } from '../modules/jlpt_kanji/schemas/jlpt_kanji.schema';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/JAVI',
    ),
    MongooseModule.forFeature([
      { name: JlptWord.name, schema: JlptWordSchema },
      { name: JlptGrammar.name, schema: JlptGrammarSchema },
      { name: JlptKanji.name, schema: JlptKanjiSchema },
    ]),
  ],
  providers: [
    JlptWordSeeder,
    JlptWordMaziiSeeder,
    JlptGrammarSeeder,
    JlptKanjiSeeder,
    JlptKanjiMaziiSeeder,
  ],
  exports: [
    JlptWordSeeder,
    JlptWordMaziiSeeder,
    JlptGrammarSeeder,
    JlptKanjiSeeder,
    JlptKanjiMaziiSeeder,
  ],
})
export class SeedModule {}
