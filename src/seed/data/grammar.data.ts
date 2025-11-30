import { JlptGrammar } from "src/modules/jlpt_grammar/schemas/jlpt_grammar.schema";


export const GRAMMAR_DATA: Partial<JlptGrammar>[] = [
  // =======================
  //          N5
  // =======================
  {
    level: 'N5',
    title: '〜です',
    mean: 'Là, dùng để khẳng định',
    usages: [
      {
        explain: 'Diễn tả sự khẳng định đơn giản.',
        synopsis: 'A は B です',
        examples: [
          {
            content: '私は学生です。',
            transcription: 'わたしは がくせい です。',
            meaning: 'Tôi là học sinh.',
          },
        ],
      },
    ],
    isJlpt: true,
  },
  {
    level: 'N5',
    title: '〜ません',
    mean: 'Phủ định (không...)',
    usages: [
      {
        explain: 'Phủ định hành động.',
        synopsis: 'V ません',
        examples: [
          {
            content: '私は肉を食べません。',
            transcription: 'わたしは にくを たべません。',
            meaning: 'Tôi không ăn thịt.',
          },
        ],
      },
    ],
    isJlpt: true,
  },
  {
    level: 'N5',
    title: '〜ました',
    mean: 'Đã (quá khứ)',
    usages: [
      {
        explain: 'Dùng để nói hành động đã xảy ra.',
        synopsis: 'V ました',
        examples: [
          {
            content: '昨日映画を見ました。',
            transcription: 'きのう えいがを みました。',
            meaning: 'Hôm qua tôi đã xem phim.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N5',
    title: '〜に行きます',
    mean: 'Đi để làm gì',
    usages: [
      {
        explain: 'Diễn tả mục đích.',
        synopsis: 'V（ます）+ に行きます',
        examples: [
          {
            content: '図書館へ勉強しに行きます。',
            transcription: 'としょかんへ べんきょうしに いきます。',
            meaning: 'Tôi đi đến thư viện để học.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N5',
    title: '〜たいです',
    mean: 'Muốn làm gì',
    usages: [
      {
        explain: 'Diễn tả mong muốn chủ quan.',
        synopsis: 'V（ます）+ たいです',
        examples: [
          {
            content: '日本へ行きたいです。',
            transcription: 'にほんへ いきたいです。',
            meaning: 'Tôi muốn đi Nhật.',
          },
        ],
      },
    ],
     isJlpt: true,
  },

  // =======================
  //          N4
  // =======================
  {
    level: 'N4',
    title: '〜ので',
    mean: 'Bởi vì / do',
    usages: [
      {
        explain: 'Diễn tả nguyên nhân tự nhiên, khách quan.',
        synopsis: 'Aので、B',
        examples: [
          {
            content: '雨が降っているので、出かけません。',
            transcription: 'あめが ふっているので、でかけません。',
            meaning: 'Vì trời mưa nên tôi không ra ngoài.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N4',
    title: '〜ながら',
    mean: 'Vừa làm A vừa làm B',
    usages: [
      {
        explain: 'Chủ ngữ thực hiện hai hành động cùng lúc.',
        synopsis: 'Vます + ながら',
        examples: [
          {
            content: '音楽を聞きながら勉強します。',
            transcription: 'おんがくを ききながら べんきょうします。',
            meaning: 'Tôi vừa nghe nhạc vừa học.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N4',
    title: '〜ほうがいい',
    mean: 'Nên / không nên',
    usages: [
      {
        explain: 'Dùng để khuyên.',
        synopsis: 'Vた + ほうがいい',
        examples: [
          {
            content: '早く寝たほうがいいですよ。',
            transcription: 'はやく ねた ほうが いいですよ。',
            meaning: 'Bạn nên ngủ sớm.',
          },
        ],
      },
    ],
     isJlpt: true,
    
  },

  // =======================
  //          N3
  // =======================
  {
    level: 'N3',
    title: '〜ように',
    mean: 'Để (nhằm mục đích)',
    usages: [
      {
        explain: 'Mục tiêu không phải do bản thân kiểm soát trực tiếp.',
        synopsis: 'Vる / Vない + ように',
        examples: [
          {
            content: '忘れないようにメモします。',
            transcription: 'わすれない ように メモします。',
            meaning: 'Để không quên, tôi ghi chú lại.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N3',
    title: '〜らしい',
    mean: 'Có vẻ như / nghe nói',
    usages: [
      {
        explain: 'Dùng khi dựa vào thông tin gián tiếp.',
        synopsis: 'A + らしい',
        examples: [
          {
            content: '今日は暑いらしいです。',
            transcription: 'きょうは あつい らしいです。',
            meaning: 'Nghe nói hôm nay nóng.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N3',
    title: '〜ても',
    mean: 'Dù ... cũng',
    usages: [
      {
        explain: 'Dùng để nói kết quả không thay đổi.',
        synopsis: 'Vても / Aくても / Nでも',
        examples: [
          {
            content: '雨が降っても行きます。',
            transcription: 'あめが ふっても いきます。',
            meaning: 'Dù trời mưa tôi vẫn đi.',
          },
        ],
      },
    ],
     isJlpt: true,
  },

  // =======================
  //          N2
  // =======================
  {
    level: 'N2',
    title: '〜に違いない',
    mean: 'Chắc chắn là',
    usages: [
      {
        explain: 'Suy đoán chắc chắn (chủ quan).',
        synopsis: 'A に違いない',
        examples: [
          {
            content: '彼は来ないに違いない。',
            transcription: 'かれは こない に ちがいない。',
            meaning: 'Chắc chắn anh ta sẽ không đến.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N2',
    title: '〜わけではない',
    mean: 'Không hẳn là / không phải là',
    usages: [
      {
        explain: 'Phủ định một phần.',
        synopsis: 'A わけではない',
        examples: [
          {
            content: '嫌いなわけではないですが、食べません。',
            transcription: 'きらいな わけでは ないですが、たべません。',
            meaning: 'Không hẳn là ghét nhưng tôi không ăn.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N2',
    title: '〜おかげで',
    mean: 'Nhờ vào',
    usages: [
      {
        explain: 'Kết quả tốt nhờ nguyên nhân.',
        synopsis: 'A おかげで B',
        examples: [
          {
            content: '先生のおかげで合格しました。',
            transcription: 'せんせい の おかげで ごうかくしました。',
            meaning: 'Nhờ thầy giáo mà tôi đã đỗ.',
          },
        ],
      },
    ],
     isJlpt: true,
  },

  // =======================
  //          N1
  // =======================
  {
    level: 'N1',
    title: '〜かと思いきや',
    mean: 'Tưởng rằng… nhưng',
    usages: [
      {
        explain: 'Dùng khi kỳ vọng khác với thực tế.',
        synopsis: 'A かと思いきや B',
        examples: [
          {
            content: '雨かと思いきや晴れた。',
            transcription: 'あめ かと おもいきや はれた。',
            meaning: 'Tưởng rằng trời mưa nhưng lại nắng.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N1',
    title: '〜に至るまで',
    mean: 'Đến cả / đến mức',
    usages: [
      {
        explain: 'Nhấn mạnh phạm vi hoặc mức độ.',
        synopsis: 'A に至るまで',
        examples: [
          {
            content: '彼は小さなことから大きなことに至るまで完璧です。',
            transcription: 'かれは ちいさなことから おおきなこと にいたるまで かんぺきです。',
            meaning: 'Anh ta hoàn hảo từ những việc nhỏ đến cả việc lớn.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
  {
    level: 'N1',
    title: '〜ではあるまいし',
    mean: 'Đâu phải là…',
    usages: [
      {
        explain: 'Dùng để trách móc hoặc phê bình.',
        synopsis: 'A ではあるまいし',
        examples: [
          {
            content: '子供ではあるまいし泣かないでください。',
            transcription: 'こども では あるまいし、なかないでください。',
            meaning: 'Đâu phải trẻ con, đừng khóc.',
          },
        ],
      },
    ],
     isJlpt: true,
  },
];
