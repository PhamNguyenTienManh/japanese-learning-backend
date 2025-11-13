import { Module } from '@nestjs/common';
import { JlptGrammarService } from './jlpt_grammar.service';
import { JlptGrammarController } from './jlpt_grammar.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { JlptGrammar, JlptGrammarSchema } from './schemas/jlpt_grammar.schema';

@Module({
   imports: [
          MongooseModule.forFeature([{ name: JlptGrammar.name, schema: JlptGrammarSchema }])
    ],
  providers: [JlptGrammarService],
  controllers: [JlptGrammarController]
})
export class JlptGrammarModule {}
