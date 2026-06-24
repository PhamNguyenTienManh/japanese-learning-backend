export interface KanaBasicPhrase {
  japanese: string;
  romaji: string;
  meaning: string;
}

export interface KanaBasicSection {
  sectionKey: 'greetings' | 'numbers' | 'pronouns' | 'phrases';
  sectionLabel: string;
  description: string;
  items: KanaBasicPhrase[];
}

export const KANA_BASICS_DATA: KanaBasicSection[] = [
  {
    sectionKey: 'greetings',
    sectionLabel: 'Chào hỏi',
    description: 'Những câu chào hỏi và cảm ơn cơ bản dùng hằng ngày.',
    items: [
      { japanese: 'おはよう', romaji: 'ohayou', meaning: 'Chào buổi sáng (thân mật)' },
      { japanese: 'おはようございます', romaji: 'ohayou gozaimasu', meaning: 'Chào buổi sáng (lịch sự)' },
      { japanese: 'こんにちは', romaji: 'konnichiwa', meaning: 'Xin chào (ban ngày)' },
      { japanese: 'こんばんは', romaji: 'konbanwa', meaning: 'Chào buổi tối' },
      { japanese: 'おやすみなさい', romaji: 'oyasuminasai', meaning: 'Chúc ngủ ngon' },
      { japanese: 'さようなら', romaji: 'sayounara', meaning: 'Tạm biệt' },
      { japanese: 'またね', romaji: 'matane', meaning: 'Hẹn gặp lại (thân mật)' },
      { japanese: 'はじめまして', romaji: 'hajimemashite', meaning: 'Rất vui được gặp (lần đầu)' },
      { japanese: 'よろしくおねがいします', romaji: 'yoroshiku onegaishimasu', meaning: 'Mong được giúp đỡ' },
      { japanese: 'ありがとう', romaji: 'arigatou', meaning: 'Cảm ơn (thân mật)' },
      { japanese: 'ありがとうございます', romaji: 'arigatou gozaimasu', meaning: 'Cảm ơn (lịch sự)' },
      { japanese: 'すみません', romaji: 'sumimasen', meaning: 'Xin lỗi / Làm phiền' },
      { japanese: 'ごめんなさい', romaji: 'gomennasai', meaning: 'Xin lỗi (chân thành)' },
      { japanese: 'いいえ', romaji: 'iie', meaning: 'Không có gì / Không phải' },
    ],
  },
  {
    sectionKey: 'numbers',
    sectionLabel: 'Số đếm',
    description: 'Số đếm cơ bản từ 1 đến 10, trăm, ngàn, vạn.',
    items: [
      { japanese: 'いち', romaji: 'ichi', meaning: '1 (một)' },
      { japanese: 'に', romaji: 'ni', meaning: '2 (hai)' },
      { japanese: 'さん', romaji: 'san', meaning: '3 (ba)' },
      { japanese: 'よん / し', romaji: 'yon / shi', meaning: '4 (bốn)' },
      { japanese: 'ご', romaji: 'go', meaning: '5 (năm)' },
      { japanese: 'ろく', romaji: 'roku', meaning: '6 (sáu)' },
      { japanese: 'なな / しち', romaji: 'nana / shichi', meaning: '7 (bảy)' },
      { japanese: 'はち', romaji: 'hachi', meaning: '8 (tám)' },
      { japanese: 'きゅう / く', romaji: 'kyuu / ku', meaning: '9 (chín)' },
      { japanese: 'じゅう', romaji: 'juu', meaning: '10 (mười)' },
      { japanese: 'ひゃく', romaji: 'hyaku', meaning: '100 (một trăm)' },
      { japanese: 'せん', romaji: 'sen', meaning: '1.000 (một ngàn)' },
      { japanese: 'まん', romaji: 'man', meaning: '10.000 (một vạn)' },
    ],
  },
  {
    sectionKey: 'pronouns',
    sectionLabel: 'Đại từ & chỉ định',
    description: 'Đại từ nhân xưng và chỉ định cơ bản.',
    items: [
      { japanese: 'わたし', romaji: 'watashi', meaning: 'Tôi' },
      { japanese: 'あなた', romaji: 'anata', meaning: 'Bạn' },
      { japanese: 'かれ', romaji: 'kare', meaning: 'Anh ấy' },
      { japanese: 'かのじょ', romaji: 'kanojo', meaning: 'Cô ấy' },
      { japanese: 'わたしたち', romaji: 'watashitachi', meaning: 'Chúng tôi' },
      { japanese: 'これ', romaji: 'kore', meaning: 'Cái này (gần người nói)' },
      { japanese: 'それ', romaji: 'sore', meaning: 'Cái đó (gần người nghe)' },
      { japanese: 'あれ', romaji: 'are', meaning: 'Cái kia (xa cả hai)' },
      { japanese: 'ここ', romaji: 'koko', meaning: 'Ở đây' },
      { japanese: 'そこ', romaji: 'soko', meaning: 'Ở đó' },
      { japanese: 'あそこ', romaji: 'asoko', meaning: 'Ở kia' },
    ],
  },
  {
    sectionKey: 'phrases',
    sectionLabel: 'Câu giao tiếp cơ bản',
    description: 'Mẫu câu thường dùng khi tự giới thiệu, hỏi đáp.',
    items: [
      { japanese: 'わたしは__です', romaji: 'watashi wa __ desu', meaning: 'Tôi là __' },
      { japanese: 'おなまえは？', romaji: 'onamae wa?', meaning: 'Bạn tên gì?' },
      { japanese: 'なんさいですか', romaji: 'nansai desu ka', meaning: 'Bạn bao nhiêu tuổi?' },
      { japanese: 'げんきですか', romaji: 'genki desu ka', meaning: 'Bạn khỏe không?' },
      { japanese: 'げんきです', romaji: 'genki desu', meaning: 'Tôi khỏe' },
      { japanese: 'はい', romaji: 'hai', meaning: 'Vâng / Có' },
      { japanese: 'いいえ', romaji: 'iie', meaning: 'Không' },
      { japanese: 'わかりました', romaji: 'wakarimashita', meaning: 'Tôi đã hiểu' },
      { japanese: 'わかりません', romaji: 'wakarimasen', meaning: 'Tôi không hiểu' },
      { japanese: 'もういちどおねがいします', romaji: 'mou ichido onegaishimasu', meaning: 'Vui lòng nhắc lại một lần nữa' },
      { japanese: 'にほんごがすこしわかります', romaji: 'nihongo ga sukoshi wakarimasu', meaning: 'Tôi hiểu một chút tiếng Nhật' },
      { japanese: 'おいくらですか', romaji: 'oikura desu ka', meaning: 'Cái này giá bao nhiêu?' },
    ],
  },
];
