import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v2 as cloudinary } from 'cloudinary';
import { WaveFile } from 'wavefile';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class TextToSpeechService {
  private readonly VOICEVOX_URL = 'http://127.0.0.1:50021';

  constructor(private config: ConfigService) {
    const ffmpegPath = this.config.get<string>('FFMPEG_PATH');
    console.log('FFMPEG PATH from service:', ffmpegPath);

    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  // Tạo file silence bằng Node.js
  private createSilence(durationSec: number, outputPath: string, sampleRate = 44100): void {
    const numSamples = Math.floor(durationSec * sampleRate);
    const wav = new WaveFile();
    wav.fromScratch(2, sampleRate, '16', new Array(numSamples * 2).fill(0));
    fs.writeFileSync(outputPath, wav.toBuffer());
  }

  async generateVoiceAndUploadToCloudinary(text: string, speaker = 6): Promise<string> {
    try {
      const sentences = text
        .split('。')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const outputDir = path.join(process.cwd(), 'pronounce_output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const tempFiles: string[] = [];

      // Tạo file silence 0.5 giây
      const silenceFile = path.join(outputDir, 'silence.wav');
      if (!fs.existsSync(silenceFile)) {
        this.createSilence(0.5, silenceFile);
      }

      // Tạo audio cho từng câu
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        const queryRes = await fetch(
          `${this.VOICEVOX_URL}/audio_query?text=${encodeURIComponent(sentence)}&speaker=${speaker}`,
          { method: 'POST' },
        );
        const queryData = await queryRes.json();

        const synthRes = await fetch(`${this.VOICEVOX_URL}/synthesis?speaker=${speaker}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryData),
        });

        const audioBuffer = await synthRes.arrayBuffer();
        const tempFile = path.join(outputDir, `temp_${i}.wav`);
        fs.writeFileSync(tempFile, Buffer.from(audioBuffer));
        tempFiles.push(tempFile);
      }

      // Ghép audio + pause
      const mergedFile = path.join(outputDir, `voicevox_merged_${Date.now()}.wav`);
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg();
        tempFiles.forEach((file, idx) => {
          command.input(file);
          if (idx < tempFiles.length - 1) {
            command.input(silenceFile);
          }
        });

        command
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
          .mergeToFile(mergedFile, outputDir);
      });

      // Xóa file tạm
      tempFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      // Giảm tốc độ audio về 0.8
      const finalFile = path.join(outputDir, `voicevox_${Date.now()}_slow.wav`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(mergedFile)
          .audioFilter('atempo=0.8')
          .on('error', err => reject(err))
          .on('end', () => resolve())
          .save(finalFile);
      });

      // Upload lên Cloudinary
      const cloudUrl = await this.uploadAudio(finalFile);

      // Xóa tất cả file local sau khi upload thành công
      if (fs.existsSync(mergedFile)) {
        fs.unlinkSync(mergedFile);
      }
      if (fs.existsSync(finalFile)) {
        fs.unlinkSync(finalFile);
      }

      return cloudUrl; // Trả về URL string từ Cloudinary

    } catch (err) {
      console.error('Lỗi khi tạo âm thanh:', err);
      throw new Error('Không thể tạo file âm thanh');
    }
  }

  async uploadAudio(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Kiểm tra file tồn tại trước khi upload
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`File không tồn tại: ${filePath}`));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'JAVI/pronounce_audio',
          resource_type: 'video',
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          // Kiểm tra result trước khi dùng
          if (!result?.secure_url) {
            return reject(new Error('Upload failed: No URL returned'));
          }

          resolve(result.secure_url); // Chỉ trả về URL string
        },
      );

      fs.createReadStream(filePath).pipe(uploadStream);
    });
  }

  async generateVoice(text: string, speaker = 6): Promise<Buffer> {
    try {
      const queryRes = await fetch(
        `${this.VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
        { method: 'POST' },
      );
      const queryData = await queryRes.json();

      const synthRes = await fetch(`${this.VOICEVOX_URL}/synthesis?speaker=${speaker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryData),
      });

      const audioBuffer = await synthRes.arrayBuffer();
      return Buffer.from(audioBuffer); // Trả về buffer trực tiếp
    } catch (err) {
      console.error('Lỗi khi tạo âm thanh:', err);
      throw new Error('Không thể tạo file âm thanh');
    }
  } 

}


// Cách chạy
// docker pull voicevox/voicevox_engine:nvidia-latest
// docker run --rm --gpus all -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:nvidia-latest
// Chạy trên container: docker run -d --name voicevox -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest


// Luồng hoạt động
// [Người dùng] 
//     ↓ (gõ chữ tiếng Nhật)
// [Website học tiếng Nhật - Frontend]
//     ↓ (gửi request)
// [Backend Server (Node.js / Spring Boot)]
//     ↓ (gọi API)
// [VOICEVOX Engine (TTS API)]
//     ↓ (trả về file .wav)
// [Backend]
//     ↓ (gửi audio về cho frontend)
// [Người dùng nghe phát âm]