import { Module } from '@nestjs/common';
import { JlptGrammarService } from './jlpt_grammar.service';
import { JlptGrammarController } from './jlpt_grammar.controller';

@Module({
  providers: [JlptGrammarService],
  controllers: [JlptGrammarController]
})
export class JlptGrammarModule {}
