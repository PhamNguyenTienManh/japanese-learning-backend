import { Injectable } from "@nestjs/common";

type FastReplyEntry = {
  patterns: string[];
  reply: string;
};

const FAST_REPLIES: FastReplyEntry[] = [
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
    patterns: ["ok", "oke", "okay", "uhm", "um", "u", "duoc", "duoc roi"],
    reply: "Ừm, mình nghe đây.",
  },
  {
    patterns: ["tam biet", "bye", "goodbye", "hen gap lai"],
    reply: "Tạm biệt bạn, chúc bạn học tiếng Nhật thật đều tay nhé.",
  },
];

@Injectable()
export class AiFastReplyService {
  public getReply(userMessage: string): string | null {
    const normalized = this.normalize(userMessage);
    if (!normalized) return null;

    return (
      FAST_REPLIES.find((entry) => entry.patterns.includes(normalized))
        ?.reply || null
    );
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
