// src/tts/tts.module.ts
import { Module } from '@nestjs/common';
import { TextToSpeechController } from './text_to_speech.controller';
import { TextToSpeechService } from './text_to_speech.service';


@Module({
  controllers: [TextToSpeechController],
  providers: [TextToSpeechService],
})
export class TextToSpeechModule {}
