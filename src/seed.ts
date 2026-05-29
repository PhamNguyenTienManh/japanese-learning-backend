import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed/seed.module';
import { JlptWordSeeder } from './seed/jlpt-word.seed';
import { JlptWordMaziiSeeder } from './seed/jlpt-word-mazii.seed';
import { JlptGrammarSeeder } from './seed/jlpt-grammar.seed';
import { JlptKanjiSeeder } from './seed/jlpt-kanji.seed';
import { JlptKanjiMaziiSeeder } from './seed/jlpt-kanji-mazii.seed';
import { ExamMaziiSeeder } from './seed/exam-mazii.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule);

  const arg = process.argv[2];

  switch (arg) {
    case 'word':
      await app.get(JlptWordSeeder).run();
      break;

    case 'word-mazii':
      await app.get(JlptWordMaziiSeeder).run();
      break;

    case 'grammar':
      await app.get(JlptGrammarSeeder).run();
      break;
    case 'kanji':
      await app.get(JlptKanjiSeeder).run();
      break;

    case 'kanji-mazii':
      await app.get(JlptKanjiMaziiSeeder).run();
      break;

    case 'exam-mazii':
      await app
        .get(ExamMaziiSeeder)
        .run(
          process.argv[3] === undefined ? undefined : Number(process.argv[3]),
          process.argv[4],
        );
      break;

    case 'all':
      await app.get(JlptWordSeeder).run();
      await app.get(JlptGrammarSeeder).run();
      break;

    default:
      console.log(`
Sử dụng:
  npm run seed:word       → Chỉ seed từ vựng local
  npm run seed:word-mazii → Seed từ vựng từ Mazii API
  npm run seed:grammar    → Chỉ seed ngữ pháp
  npm run seed:kanji      → Chỉ seed kanji local
  npm run seed:kanji-mazii → Seed kanji từ Mazii API
  npm run seed:exam-mazii -- 739 N5 → Seed bài exam từ Mazii API
  ts-node src/seed.ts all → Seed cả từ vựng và ngữ pháp
`);
  }

  await app.close();
}

bootstrap();
