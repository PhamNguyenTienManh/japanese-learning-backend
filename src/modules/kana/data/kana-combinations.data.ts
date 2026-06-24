import type { KanaChar, KanaSyllabary } from './kana-characters.data';

export interface KanaCombinationGroup {
  groupKey: string;
  label: string;
  characters: KanaChar[];
}

export interface KanaCombinationSection {
  sectionKey: 'dakuten' | 'handakuten' | 'yoon';
  sectionLabel: string;
  description: string;
  groups: KanaCombinationGroup[];
}

export const KANA_COMBINATIONS_DATA: Record<KanaSyllabary, KanaCombinationSection[]> = {
  hiragana: [
    {
      sectionKey: 'dakuten',
      sectionLabel: 'Dakuten (゛)',
      description: 'Thêm dấu " để biến phụ âm vô thanh thành hữu thanh (k→g, s→z, t→d, h→b).',
      groups: [
        {
          groupKey: 'ga',
          label: 'が',
          characters: [
            { character: 'が', romaji: 'ga', groupKey: 'ga' },
            { character: 'ぎ', romaji: 'gi', groupKey: 'ga' },
            { character: 'ぐ', romaji: 'gu', groupKey: 'ga' },
            { character: 'げ', romaji: 'ge', groupKey: 'ga' },
            { character: 'ご', romaji: 'go', groupKey: 'ga' },
          ],
        },
        {
          groupKey: 'za',
          label: 'ざ',
          characters: [
            { character: 'ざ', romaji: 'za', groupKey: 'za' },
            { character: 'じ', romaji: 'ji', groupKey: 'za' },
            { character: 'ず', romaji: 'zu', groupKey: 'za' },
            { character: 'ぜ', romaji: 'ze', groupKey: 'za' },
            { character: 'ぞ', romaji: 'zo', groupKey: 'za' },
          ],
        },
        {
          groupKey: 'da',
          label: 'だ',
          characters: [
            { character: 'だ', romaji: 'da', groupKey: 'da' },
            { character: 'ぢ', romaji: 'ji', groupKey: 'da' },
            { character: 'づ', romaji: 'zu', groupKey: 'da' },
            { character: 'で', romaji: 'de', groupKey: 'da' },
            { character: 'ど', romaji: 'do', groupKey: 'da' },
          ],
        },
        {
          groupKey: 'ba',
          label: 'ば',
          characters: [
            { character: 'ば', romaji: 'ba', groupKey: 'ba' },
            { character: 'び', romaji: 'bi', groupKey: 'ba' },
            { character: 'ぶ', romaji: 'bu', groupKey: 'ba' },
            { character: 'べ', romaji: 'be', groupKey: 'ba' },
            { character: 'ぼ', romaji: 'bo', groupKey: 'ba' },
          ],
        },
      ],
    },
    {
      sectionKey: 'handakuten',
      sectionLabel: 'Handakuten (゜)',
      description: 'Thêm dấu ° để biến hàng は thành hàng ぱ (h→p).',
      groups: [
        {
          groupKey: 'pa',
          label: 'ぱ',
          characters: [
            { character: 'ぱ', romaji: 'pa', groupKey: 'pa' },
            { character: 'ぴ', romaji: 'pi', groupKey: 'pa' },
            { character: 'ぷ', romaji: 'pu', groupKey: 'pa' },
            { character: 'ぺ', romaji: 'pe', groupKey: 'pa' },
            { character: 'ぽ', romaji: 'po', groupKey: 'pa' },
          ],
        },
      ],
    },
    {
      sectionKey: 'yoon',
      sectionLabel: 'Yoon (拗音)',
      description: 'Ghép phụ âm hàng i (き、し、ち、…) với や/ゆ/よ nhỏ để tạo âm mới.',
      groups: [
        {
          groupKey: 'kya',
          label: 'きゃ',
          characters: [
            { character: 'きゃ', romaji: 'kya', groupKey: 'kya' },
            { character: 'きゅ', romaji: 'kyu', groupKey: 'kya' },
            { character: 'きょ', romaji: 'kyo', groupKey: 'kya' },
          ],
        },
        {
          groupKey: 'sha',
          label: 'しゃ',
          characters: [
            { character: 'しゃ', romaji: 'sha', groupKey: 'sha' },
            { character: 'しゅ', romaji: 'shu', groupKey: 'sha' },
            { character: 'しょ', romaji: 'sho', groupKey: 'sha' },
          ],
        },
        {
          groupKey: 'cha',
          label: 'ちゃ',
          characters: [
            { character: 'ちゃ', romaji: 'cha', groupKey: 'cha' },
            { character: 'ちゅ', romaji: 'chu', groupKey: 'cha' },
            { character: 'ちょ', romaji: 'cho', groupKey: 'cha' },
          ],
        },
        {
          groupKey: 'nya',
          label: 'にゃ',
          characters: [
            { character: 'にゃ', romaji: 'nya', groupKey: 'nya' },
            { character: 'にゅ', romaji: 'nyu', groupKey: 'nya' },
            { character: 'にょ', romaji: 'nyo', groupKey: 'nya' },
          ],
        },
        {
          groupKey: 'hya',
          label: 'ひゃ',
          characters: [
            { character: 'ひゃ', romaji: 'hya', groupKey: 'hya' },
            { character: 'ひゅ', romaji: 'hyu', groupKey: 'hya' },
            { character: 'ひょ', romaji: 'hyo', groupKey: 'hya' },
          ],
        },
        {
          groupKey: 'mya',
          label: 'みゃ',
          characters: [
            { character: 'みゃ', romaji: 'mya', groupKey: 'mya' },
            { character: 'みゅ', romaji: 'myu', groupKey: 'mya' },
            { character: 'みょ', romaji: 'myo', groupKey: 'mya' },
          ],
        },
        {
          groupKey: 'rya',
          label: 'りゃ',
          characters: [
            { character: 'りゃ', romaji: 'rya', groupKey: 'rya' },
            { character: 'りゅ', romaji: 'ryu', groupKey: 'rya' },
            { character: 'りょ', romaji: 'ryo', groupKey: 'rya' },
          ],
        },
        {
          groupKey: 'gya',
          label: 'ぎゃ',
          characters: [
            { character: 'ぎゃ', romaji: 'gya', groupKey: 'gya' },
            { character: 'ぎゅ', romaji: 'gyu', groupKey: 'gya' },
            { character: 'ぎょ', romaji: 'gyo', groupKey: 'gya' },
          ],
        },
        {
          groupKey: 'ja',
          label: 'じゃ',
          characters: [
            { character: 'じゃ', romaji: 'ja', groupKey: 'ja' },
            { character: 'じゅ', romaji: 'ju', groupKey: 'ja' },
            { character: 'じょ', romaji: 'jo', groupKey: 'ja' },
          ],
        },
        {
          groupKey: 'bya',
          label: 'びゃ',
          characters: [
            { character: 'びゃ', romaji: 'bya', groupKey: 'bya' },
            { character: 'びゅ', romaji: 'byu', groupKey: 'bya' },
            { character: 'びょ', romaji: 'byo', groupKey: 'bya' },
          ],
        },
        {
          groupKey: 'pya',
          label: 'ぴゃ',
          characters: [
            { character: 'ぴゃ', romaji: 'pya', groupKey: 'pya' },
            { character: 'ぴゅ', romaji: 'pyu', groupKey: 'pya' },
            { character: 'ぴょ', romaji: 'pyo', groupKey: 'pya' },
          ],
        },
      ],
    },
  ],
  katakana: [
    {
      sectionKey: 'dakuten',
      sectionLabel: 'Dakuten (゛)',
      description: 'Thêm dấu " để biến phụ âm vô thanh thành hữu thanh (k→g, s→z, t→d, h→b).',
      groups: [
        {
          groupKey: 'ga',
          label: 'ガ',
          characters: [
            { character: 'ガ', romaji: 'ga', groupKey: 'ga' },
            { character: 'ギ', romaji: 'gi', groupKey: 'ga' },
            { character: 'グ', romaji: 'gu', groupKey: 'ga' },
            { character: 'ゲ', romaji: 'ge', groupKey: 'ga' },
            { character: 'ゴ', romaji: 'go', groupKey: 'ga' },
          ],
        },
        {
          groupKey: 'za',
          label: 'ザ',
          characters: [
            { character: 'ザ', romaji: 'za', groupKey: 'za' },
            { character: 'ジ', romaji: 'ji', groupKey: 'za' },
            { character: 'ズ', romaji: 'zu', groupKey: 'za' },
            { character: 'ゼ', romaji: 'ze', groupKey: 'za' },
            { character: 'ゾ', romaji: 'zo', groupKey: 'za' },
          ],
        },
        {
          groupKey: 'da',
          label: 'ダ',
          characters: [
            { character: 'ダ', romaji: 'da', groupKey: 'da' },
            { character: 'ヂ', romaji: 'ji', groupKey: 'da' },
            { character: 'ヅ', romaji: 'zu', groupKey: 'da' },
            { character: 'デ', romaji: 'de', groupKey: 'da' },
            { character: 'ド', romaji: 'do', groupKey: 'da' },
          ],
        },
        {
          groupKey: 'ba',
          label: 'バ',
          characters: [
            { character: 'バ', romaji: 'ba', groupKey: 'ba' },
            { character: 'ビ', romaji: 'bi', groupKey: 'ba' },
            { character: 'ブ', romaji: 'bu', groupKey: 'ba' },
            { character: 'ベ', romaji: 'be', groupKey: 'ba' },
            { character: 'ボ', romaji: 'bo', groupKey: 'ba' },
          ],
        },
      ],
    },
    {
      sectionKey: 'handakuten',
      sectionLabel: 'Handakuten (゜)',
      description: 'Thêm dấu ° để biến hàng ハ thành hàng パ (h→p).',
      groups: [
        {
          groupKey: 'pa',
          label: 'パ',
          characters: [
            { character: 'パ', romaji: 'pa', groupKey: 'pa' },
            { character: 'ピ', romaji: 'pi', groupKey: 'pa' },
            { character: 'プ', romaji: 'pu', groupKey: 'pa' },
            { character: 'ペ', romaji: 'pe', groupKey: 'pa' },
            { character: 'ポ', romaji: 'po', groupKey: 'pa' },
          ],
        },
      ],
    },
    {
      sectionKey: 'yoon',
      sectionLabel: 'Yoon (拗音)',
      description: 'Ghép phụ âm hàng i với ャ/ュ/ョ nhỏ để tạo âm mới.',
      groups: [
        {
          groupKey: 'kya',
          label: 'キャ',
          characters: [
            { character: 'キャ', romaji: 'kya', groupKey: 'kya' },
            { character: 'キュ', romaji: 'kyu', groupKey: 'kya' },
            { character: 'キョ', romaji: 'kyo', groupKey: 'kya' },
          ],
        },
        {
          groupKey: 'sha',
          label: 'シャ',
          characters: [
            { character: 'シャ', romaji: 'sha', groupKey: 'sha' },
            { character: 'シュ', romaji: 'shu', groupKey: 'sha' },
            { character: 'ショ', romaji: 'sho', groupKey: 'sha' },
          ],
        },
        {
          groupKey: 'cha',
          label: 'チャ',
          characters: [
            { character: 'チャ', romaji: 'cha', groupKey: 'cha' },
            { character: 'チュ', romaji: 'chu', groupKey: 'cha' },
            { character: 'チョ', romaji: 'cho', groupKey: 'cha' },
          ],
        },
        {
          groupKey: 'nya',
          label: 'ニャ',
          characters: [
            { character: 'ニャ', romaji: 'nya', groupKey: 'nya' },
            { character: 'ニュ', romaji: 'nyu', groupKey: 'nya' },
            { character: 'ニョ', romaji: 'nyo', groupKey: 'nya' },
          ],
        },
        {
          groupKey: 'hya',
          label: 'ヒャ',
          characters: [
            { character: 'ヒャ', romaji: 'hya', groupKey: 'hya' },
            { character: 'ヒュ', romaji: 'hyu', groupKey: 'hya' },
            { character: 'ヒョ', romaji: 'hyo', groupKey: 'hya' },
          ],
        },
        {
          groupKey: 'mya',
          label: 'ミャ',
          characters: [
            { character: 'ミャ', romaji: 'mya', groupKey: 'mya' },
            { character: 'ミュ', romaji: 'myu', groupKey: 'mya' },
            { character: 'ミョ', romaji: 'myo', groupKey: 'mya' },
          ],
        },
        {
          groupKey: 'rya',
          label: 'リャ',
          characters: [
            { character: 'リャ', romaji: 'rya', groupKey: 'rya' },
            { character: 'リュ', romaji: 'ryu', groupKey: 'rya' },
            { character: 'リョ', romaji: 'ryo', groupKey: 'rya' },
          ],
        },
        {
          groupKey: 'gya',
          label: 'ギャ',
          characters: [
            { character: 'ギャ', romaji: 'gya', groupKey: 'gya' },
            { character: 'ギュ', romaji: 'gyu', groupKey: 'gya' },
            { character: 'ギョ', romaji: 'gyo', groupKey: 'gya' },
          ],
        },
        {
          groupKey: 'ja',
          label: 'ジャ',
          characters: [
            { character: 'ジャ', romaji: 'ja', groupKey: 'ja' },
            { character: 'ジュ', romaji: 'ju', groupKey: 'ja' },
            { character: 'ジョ', romaji: 'jo', groupKey: 'ja' },
          ],
        },
        {
          groupKey: 'bya',
          label: 'ビャ',
          characters: [
            { character: 'ビャ', romaji: 'bya', groupKey: 'bya' },
            { character: 'ビュ', romaji: 'byu', groupKey: 'bya' },
            { character: 'ビョ', romaji: 'byo', groupKey: 'bya' },
          ],
        },
        {
          groupKey: 'pya',
          label: 'ピャ',
          characters: [
            { character: 'ピャ', romaji: 'pya', groupKey: 'pya' },
            { character: 'ピュ', romaji: 'pyu', groupKey: 'pya' },
            { character: 'ピョ', romaji: 'pyo', groupKey: 'pya' },
          ],
        },
      ],
    },
  ],
};
