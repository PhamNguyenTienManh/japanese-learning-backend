import { Injectable } from "@nestjs/common";

type FastReplyEntry = {
  patterns: string[];
  reply: string;
};

const OUT_OF_SCOPE_REPLY =
  "Mình là JAVI AI nên chỉ hỗ trợ các nội dung liên quan đến học tiếng Nhật trên JAVI: dịch Nhật - Việt, ngữ pháp, từ vựng, kanji, JLPT, hội thoại và sổ tay học tập. Câu hỏi này nằm ngoài phạm vi đó, nên mình chưa thể hỗ trợ.";

const JAPANESE_SCRIPT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/u;

const JAPANESE_LEARNING_KEYWORDS = [
  "tieng nhat",
  "jlpt",
  "kanji",
  "hiragana",
  "katakana",
  "romaji",
  "ngu phap",
  "tu vung",
  "phat am",
  "dich nhat",
  "nhat viet",
  "viet nhat",
  "hoi thoai",
  "luyen nghe",
  "luyen doc",
  "bunpou",
  "kotoba",
  "kaiwa",
  "so tay",
  "notebook",
  "n5",
  "n4",
  "n3",
  "n2",
  "n1",
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(code|coding|lap trinh|javascript|typescript|python|java|react|nodejs|nestjs|spring|sql|database|docker|git|api|html|css|debug|source code|thuat toan|algorithm)\b/i,
  /\b(bai toan|cong thuc|phuong trinh|dao ham|tich phan|xac suat|to hop|so nguyen|chu so|so luong chu so|dem so|day so)\b/i,
  /\b(chinh tri|phap luat|kinh doanh|dau tu|suc khoe|tinh cam|du lich|dia diem|an uong)\b/i,
];

const FAST_REPLIES: FastReplyEntry[] = [
  {
    patterns: [
      "ban la ai",
      "ban la ai vay",
      "ban la ai the",
      "may la ai",
      "m la ai",
      "who are you",
      "what are you",
    ],
    reply:
      "Mình là JAVI AI, trợ lý AI của website JAVI. Mình hỗ trợ bạn học tiếng Nhật: giải thích ngữ pháp, dịch Nhật - Việt, luyện hội thoại, gợi ý từ vựng/kanji, hỗ trợ JLPT và quản lý sổ tay học tập.",
  },
  {
    patterns: [
      "hi",
      "hello",
      "hey",
      "xin chao",
      "chao",
      "chao ban",
      "hello ban",
      "hi ban",
    ],
    reply: "Chào bạn! Mình sẵn sàng hỗ trợ bạn học tiếng Nhật hôm nay.",
  },
  {
    patterns: [
      "cam on",
      "cam on ban",
      "thanks",
      "thank you",
      "thank",
      "arigatou",
      "arigato",
    ],
    reply:
      "Không có gì đâu. Cần luyện thêm từ vựng, ngữ pháp hay hội thoại thì cứ nhắn mình nhé.",
  },
  {
    patterns: ["tam biet", "bye", "goodbye", "hen gap lai", "bai", "bai bạn", "Gud bye"],
    reply: "Tạm biệt bạn, chúc bạn học tiếng Nhật thật đều tay nhé.",
  },
];

@Injectable()
export class AiFastReplyService {
  public getReply(userMessage: string): string | null {
    const normalized = this.normalize(userMessage);
    if (!normalized) return null;

    const fastReply =
      FAST_REPLIES.find((entry) => entry.patterns.includes(normalized))
        ?.reply || null;
    if (fastReply) return fastReply;

    if (this.isOutOfScope(userMessage, normalized)) {
      return OUT_OF_SCOPE_REPLY;
    }

    return null;
  }

  private isOutOfScope(original: string, normalized: string) {
    if (JAPANESE_SCRIPT_PATTERN.test(original || "")) return false;
    if (JAPANESE_LEARNING_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return false;
    }

    return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private normalize(value: string) {
    return (value || "")
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
