import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed/seed.module';
import { JlptWordSeeder } from './seed/jlpt-word.seed';
import { JlptGrammarSeeder } from './seed/jlpt-grammar.seed';
import { JlptKanjiSeeder } from './seed/jlpt-kanji.seed';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule);

  const arg = process.argv[2];

  switch (arg) {
    case 'word':
      await app.get(JlptWordSeeder).run();
      break;

    case 'grammar':
      await app.get(JlptGrammarSeeder).run();
      break;
    case 'kanji':
      await app.get(JlptKanjiSeeder).run();
      break;
    case 'all':
      await app.get(JlptWordSeeder).run();
      await app.get(JlptGrammarSeeder).run();
      break;

    default:
      console.log(`
Sử dụng:
  npm run seed jlpt      → Chỉ seed từ vựng
  npm run seed grammar   → Chỉ seed ngữ pháp
  npm run seed all       → Seed cả từ vựng và ngữ pháp
`);
  }

  await app.close();
}

bootstrap();
