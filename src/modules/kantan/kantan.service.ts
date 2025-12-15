// src/kantan/kantan.service.ts

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { KanjiSearchDto, KanjiItemDto, KanjiResponseDto } from './dto/kanji-search.dto';

@Injectable()
export class KantanService {
  private readonly apiUrl = 'https://kantan.vn/postrequest.ashx';

  constructor(private readonly httpService: HttpService) {}

  async searchKanji(searchDto: KanjiSearchDto): Promise<KanjiResponseDto> {
    try {
      const formData = new URLSearchParams();
      formData.append('m', 'dictionary');
      formData.append('fn', 'kanji_list');
      formData.append('level', searchDto.level.toString());
      formData.append('strokeNumber', searchDto.strokeNumber.toString());
      formData.append('keyword', searchDto.keyword);
      formData.append('pageIndex', searchDto.pageIndex.toString());

      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, formData.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      const apiResponse = response.data;
      if (!apiResponse.Success) {
        throw new HttpException(
          apiResponse.Message || 'API request failed',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Parse HTML content
      const kanjiData = this.parseHtmlContent(apiResponse.Content);

      return {
        success: true,
        message: apiResponse.Message,
        data: kanjiData,
        totalRow: apiResponse.TotalRow,
        errorCode: apiResponse.ErrorCode,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch kanji data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private parseHtmlContent(html: string): KanjiItemDto[] {
    const $ = cheerio.load(html);
    const kanjiItems: KanjiItemDto[] = [];

    $('.kanji-in-list-item').each((_, element) => {
      const $item = $(element);
      
      // Lấy ID từ div.img
      const imgDiv = $item.find('.img');
      const id = imgDiv.attr('id')?.replace('listdmakid', '') || '';
      
      // Lấy ký tự kanji
      const character = imgDiv.attr('data-text') || '';
      
      // Lấy nghĩa (heading)
      const meaning = $item.find('.info h3').text().trim();
      
      // Lấy mô tả
      const description = $item.find('.info > p > p').text().trim();
      
      // Lấy onyomi và kunyomi
      const onyomi: string[] = [];
      const kunyomi: string[] = [];
      
      $item.find('.info .lst li a').each((_, link) => {
        const $link = $(link);
        const text = $link.text().trim();
        
        if ($link.hasClass('ony')) {
          onyomi.push(text);
        } else if ($link.hasClass('kuny')) {
          kunyomi.push(text);
        }
      });

      kanjiItems.push({
        id,
        character,
        meaning,
        description,
        onyomi,
        kunyomi,
      });
    });

    return kanjiItems;
  }
}