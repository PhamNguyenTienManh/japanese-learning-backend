import { Module } from '@nestjs/common';
import { JlptWordSeeder } from './jlpt-word.seed';
import { JlptGrammarSeeder } from './jlpt-grammar.seed';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptWord, JlptWordSchema } from '../modules/jlpt_word/schemas/jlpt_word.schema';
import { JlptGrammar, JlptGrammarSchema } from '../modules/jlpt_grammar/schemas/jlpt_grammar.schema';
import { JlptKanjiSeeder } from './jlpt-kanji.seed';
import { JlptKanji, JlptKanjiSchema } from '../modules/jlpt_kanji/schemas/jlpt_kanji.schema';


@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/JAVI'),
    MongooseModule.forFeature([
      { name: JlptWord.name, schema: JlptWordSchema },
      { name: JlptGrammar.name, schema: JlptGrammarSchema },
      { name: JlptKanji.name, schema: JlptKanjiSchema },
    ]),
  ],
  providers: [JlptWordSeeder, JlptGrammarSeeder, JlptKanjiSeeder],
  exports: [JlptWordSeeder, JlptGrammarSeeder, JlptKanjiSeeder],
})
export class SeedModule {}
