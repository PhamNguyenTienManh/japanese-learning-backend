export type KanaSyllabary = 'hiragana' | 'katakana';

export interface KanaChar {
  character: string;
  romaji: string;
  groupKey: string;
}

export const KANA_GROUP_ORDER: string[] = [
  'a',
  'ka',
  'sa',
  'ta',
  'na',
  'ha',
  'ma',
  'ya',
  'ra',
  'wa',
  'n',
];

export const KANA_GROUP_LABELS: Record<string, { hiragana: string; katakana: string }> = {
  a: { hiragana: 'あ', katakana: 'ア' },
  ka: { hiragana: 'か', katakana: 'カ' },
  sa: { hiragana: 'さ', katakana: 'サ' },
  ta: { hiragana: 'た', katakana: 'タ' },
  na: { hiragana: 'な', katakana: 'ナ' },
  ha: { hiragana: 'は', katakana: 'ハ' },
  ma: { hiragana: 'ま', katakana: 'マ' },
  ya: { hiragana: 'や', katakana: 'ヤ' },
  ra: { hiragana: 'ら', katakana: 'ラ' },
  wa: { hiragana: 'わ', katakana: 'ワ' },
  n: { hiragana: 'ん', katakana: 'ン' },
};

export const KANA_DATA: Record<KanaSyllabary, KanaChar[]> = {
  hiragana: [
    { character: 'あ', romaji: 'a', groupKey: 'a' },
    { character: 'い', romaji: 'i', groupKey: 'a' },
    { character: 'う', romaji: 'u', groupKey: 'a' },
    { character: 'え', romaji: 'e', groupKey: 'a' },
    { character: 'お', romaji: 'o', groupKey: 'a' },

    { character: 'か', romaji: 'ka', groupKey: 'ka' },
    { character: 'き', romaji: 'ki', groupKey: 'ka' },
    { character: 'く', romaji: 'ku', groupKey: 'ka' },
    { character: 'け', romaji: 'ke', groupKey: 'ka' },
    { character: 'こ', romaji: 'ko', groupKey: 'ka' },

    { character: 'さ', romaji: 'sa', groupKey: 'sa' },
    { character: 'し', romaji: 'shi', groupKey: 'sa' },
    { character: 'す', romaji: 'su', groupKey: 'sa' },
    { character: 'せ', romaji: 'se', groupKey: 'sa' },
    { character: 'そ', romaji: 'so', groupKey: 'sa' },

    { character: 'た', romaji: 'ta', groupKey: 'ta' },
    { character: 'ち', romaji: 'chi', groupKey: 'ta' },
    { character: 'つ', romaji: 'tsu', groupKey: 'ta' },
    { character: 'て', romaji: 'te', groupKey: 'ta' },
    { character: 'と', romaji: 'to', groupKey: 'ta' },

    { character: 'な', romaji: 'na', groupKey: 'na' },
    { character: 'に', romaji: 'ni', groupKey: 'na' },
    { character: 'ぬ', romaji: 'nu', groupKey: 'na' },
    { character: 'ね', romaji: 'ne', groupKey: 'na' },
    { character: 'の', romaji: 'no', groupKey: 'na' },

    { character: 'は', romaji: 'ha', groupKey: 'ha' },
    { character: 'ひ', romaji: 'hi', groupKey: 'ha' },
    { character: 'ふ', romaji: 'fu', groupKey: 'ha' },
    { character: 'へ', romaji: 'he', groupKey: 'ha' },
    { character: 'ほ', romaji: 'ho', groupKey: 'ha' },

    { character: 'ま', romaji: 'ma', groupKey: 'ma' },
    { character: 'み', romaji: 'mi', groupKey: 'ma' },
    { character: 'む', romaji: 'mu', groupKey: 'ma' },
    { character: 'め', romaji: 'me', groupKey: 'ma' },
    { character: 'も', romaji: 'mo', groupKey: 'ma' },

    { character: 'や', romaji: 'ya', groupKey: 'ya' },
    { character: 'ゆ', romaji: 'yu', groupKey: 'ya' },
    { character: 'よ', romaji: 'yo', groupKey: 'ya' },

    { character: 'ら', romaji: 'ra', groupKey: 'ra' },
    { character: 'り', romaji: 'ri', groupKey: 'ra' },
    { character: 'る', romaji: 'ru', groupKey: 'ra' },
    { character: 'れ', romaji: 're', groupKey: 'ra' },
    { character: 'ろ', romaji: 'ro', groupKey: 'ra' },

    { character: 'わ', romaji: 'wa', groupKey: 'wa' },
    { character: 'を', romaji: 'wo', groupKey: 'wa' },

    { character: 'ん', romaji: 'n', groupKey: 'n' },
  ],
  katakana: [
    { character: 'ア', romaji: 'a', groupKey: 'a' },
    { character: 'イ', romaji: 'i', groupKey: 'a' },
    { character: 'ウ', romaji: 'u', groupKey: 'a' },
    { character: 'エ', romaji: 'e', groupKey: 'a' },
    { character: 'オ', romaji: 'o', groupKey: 'a' },

    { character: 'カ', romaji: 'ka', groupKey: 'ka' },
    { character: 'キ', romaji: 'ki', groupKey: 'ka' },
    { character: 'ク', romaji: 'ku', groupKey: 'ka' },
    { character: 'ケ', romaji: 'ke', groupKey: 'ka' },
    { character: 'コ', romaji: 'ko', groupKey: 'ka' },

    { character: 'サ', romaji: 'sa', groupKey: 'sa' },
    { character: 'シ', romaji: 'shi', groupKey: 'sa' },
    { character: 'ス', romaji: 'su', groupKey: 'sa' },
    { character: 'セ', romaji: 'se', groupKey: 'sa' },
    { character: 'ソ', romaji: 'so', groupKey: 'sa' },

    { character: 'タ', romaji: 'ta', groupKey: 'ta' },
    { character: 'チ', romaji: 'chi', groupKey: 'ta' },
    { character: 'ツ', romaji: 'tsu', groupKey: 'ta' },
    { character: 'テ', romaji: 'te', groupKey: 'ta' },
    { character: 'ト', romaji: 'to', groupKey: 'ta' },

    { character: 'ナ', romaji: 'na', groupKey: 'na' },
    { character: 'ニ', romaji: 'ni', groupKey: 'na' },
    { character: 'ヌ', romaji: 'nu', groupKey: 'na' },
    { character: 'ネ', romaji: 'ne', groupKey: 'na' },
    { character: 'ノ', romaji: 'no', groupKey: 'na' },

    { character: 'ハ', romaji: 'ha', groupKey: 'ha' },
    { character: 'ヒ', romaji: 'hi', groupKey: 'ha' },
    { character: 'フ', romaji: 'fu', groupKey: 'ha' },
    { character: 'ヘ', romaji: 'he', groupKey: 'ha' },
    { character: 'ホ', romaji: 'ho', groupKey: 'ha' },

    { character: 'マ', romaji: 'ma', groupKey: 'ma' },
    { character: 'ミ', romaji: 'mi', groupKey: 'ma' },
    { character: 'ム', romaji: 'mu', groupKey: 'ma' },
    { character: 'メ', romaji: 'me', groupKey: 'ma' },
    { character: 'モ', romaji: 'mo', groupKey: 'ma' },

    { character: 'ヤ', romaji: 'ya', groupKey: 'ya' },
    { character: 'ユ', romaji: 'yu', groupKey: 'ya' },
    { character: 'ヨ', romaji: 'yo', groupKey: 'ya' },

    { character: 'ラ', romaji: 'ra', groupKey: 'ra' },
    { character: 'リ', romaji: 'ri', groupKey: 'ra' },
    { character: 'ル', romaji: 'ru', groupKey: 'ra' },
    { character: 'レ', romaji: 're', groupKey: 'ra' },
    { character: 'ロ', romaji: 'ro', groupKey: 'ra' },

    { character: 'ワ', romaji: 'wa', groupKey: 'wa' },
    { character: 'ヲ', romaji: 'wo', groupKey: 'wa' },

    { character: 'ン', romaji: 'n', groupKey: 'n' },
  ],
};
