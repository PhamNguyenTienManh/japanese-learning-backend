import { BadRequestException, Injectable } from '@nestjs/common';
import {
  KANA_DATA,
  KANA_GROUP_LABELS,
  KANA_GROUP_ORDER,
  KanaChar,
  KanaSyllabary,
} from './data/kana-characters.data';
import {
  KANA_COMBINATIONS_DATA,
  KanaCombinationSection,
} from './data/kana-combinations.data';
import { KANA_BASICS_DATA, KanaBasicSection } from './data/kana-basics.data';

export interface KanaGroupResponse {
  groupKey: string;
  label: string;
  order: number;
  characters: KanaChar[];
}

@Injectable()
export class KanaService {
  getGroups(syllabary: KanaSyllabary): KanaGroupResponse[] {
    if (syllabary !== 'hiragana' && syllabary !== 'katakana') {
      throw new BadRequestException('syllabary must be hiragana or katakana');
    }

    const characters = KANA_DATA[syllabary];
    const grouped = new Map<string, KanaChar[]>();
    for (const c of characters) {
      if (!grouped.has(c.groupKey)) grouped.set(c.groupKey, []);
      grouped.get(c.groupKey)!.push(c);
    }

    return KANA_GROUP_ORDER.filter((key) => grouped.has(key)).map((groupKey, index) => ({
      groupKey,
      label: KANA_GROUP_LABELS[groupKey]?.[syllabary] ?? groupKey,
      order: index + 1,
      characters: grouped.get(groupKey) ?? [],
    }));
  }

  getCombinations(syllabary: KanaSyllabary): KanaCombinationSection[] {
    if (syllabary !== 'hiragana' && syllabary !== 'katakana') {
      throw new BadRequestException('syllabary must be hiragana or katakana');
    }
    return KANA_COMBINATIONS_DATA[syllabary];
  }

  getBasics(): KanaBasicSection[] {
    return KANA_BASICS_DATA;
  }
}
