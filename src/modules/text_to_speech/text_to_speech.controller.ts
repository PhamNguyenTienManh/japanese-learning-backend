import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { TextToSpeechService } from './text_to_speech.service';
import { Public } from '../auth/public.decorator';
import { type Response } from 'express';
import { DialogueVoiceLine, SyncData } from './text_to_speech.service';

@Controller('text_to_speech')
export class TextToSpeechController {
  constructor(private readonly textToSpeechService: TextToSpeechService) {}

  @Public()
  @Post("upload")
  async createVoiceAndUpload(@Body() body: { text: string; speaker?: number }): Promise<{ audioUrl: string; syncData: SyncData[] }> {
    const { text, speaker = 6 } = body;
    
    // Nhận URL từ Cloudinary
    const result = await this.textToSpeechService.generateVoiceAndUploadToCloudinary(text, speaker);

    // Trả về URL để client sử dụng
    return {
      audioUrl: result.url,
      syncData: result.syncData
    };
  }

  @Public()
  @Get("speakers")
  async getSpeakers(): Promise<any[]> {
    return this.textToSpeechService.getSpeakers();
  }

  @Public()
  @Post("dialogue/upload")
  async createDialogueVoiceAndUpload(
    @Body() body: { lines: DialogueVoiceLine[]; pauseMs?: number },
  ): Promise<{ audioUrl: string; syncData: SyncData[] }> {
    const result = await this.textToSpeechService.generateDialogueVoiceAndUploadToCloudinary(
      body.lines,
      body.pauseMs ?? 500,
    );

    return {
      audioUrl: result.url,
      syncData: result.syncData,
    };
  }

  @Public()
  @Post()
  async createVoice(@Body() body: { text: string; speaker?: number }, @Res() res: Response) {
    const { text, speaker = 6 } = body;
    try {
      const audioBuffer = await this.textToSpeechService.generateVoice(text, speaker);

      res.set({
        'Content-Type': 'audio/wav',
        'Content-Disposition': 'inline; filename="voice.wav"',
      });
      res.send(audioBuffer); // Trả trực tiếp buffer mà không cần file
    } catch (err) {
      res.status(500).json({ message: 'Lỗi khi tạo âm thanh' });
    }
  }

}

// Client sử dụng:
// <audio src={response.audioUrl} controls></audio>
