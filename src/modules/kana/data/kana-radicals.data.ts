/**
 * 80 bộ thủ đầu tiên theo thứ tự Kangxi (康熙部首 #1 – #80).
 * Nguồn: danh sách 214 bộ thủ Kangxi chuẩn, chia theo số nét.
 *
 * - radical:     ký tự bộ thủ Unicode
 * - strokeCount: số nét chính xác theo Kangxi
 * - reading:     cách gọi bộ thủ trong tiếng Nhật (tên bộ)
 * - meaning:     nghĩa tiếng Việt
 */

export interface KanaRadical {
  radical: string;
  strokeCount: number;
  reading: string;
  meaning: string;
}

export interface KanaRadicalSection {
  sectionKey: string;
  sectionLabel: string;
  description: string;
  items: KanaRadical[];
}

export const KANA_RADICALS_DATA: KanaRadicalSection[] = [
  // ── 1 nét — Kangxi #1–#6 ──
  {
    sectionKey: '1-stroke',
    sectionLabel: '1 nét',
    description: 'Bộ thủ đơn giản nhất, chỉ có 1 nét — Kangxi #1 – #6.',
    items: [
      { radical: '一', strokeCount: 1, reading: 'いち', meaning: 'Một' },
      { radical: '丨', strokeCount: 1, reading: 'ぼう', meaning: 'Nét sổ' },
      { radical: '丶', strokeCount: 1, reading: 'てん', meaning: 'Chấm' },
      { radical: '丿', strokeCount: 1, reading: 'の', meaning: 'Nét phẩy' },
      { radical: '乙', strokeCount: 1, reading: 'おつ', meaning: 'Ngoặc / Ất' },
      { radical: '亅', strokeCount: 1, reading: 'はねぼう', meaning: 'Nét móc' },
    ],
  },

  // ── 2 nét — Kangxi #7–#29 ──
  {
    sectionKey: '2-stroke',
    sectionLabel: '2 nét',
    description: 'Bộ thủ 2 nét — xuất hiện rất phổ biến trong kanji cơ bản. Kangxi #7 – #29.',
    items: [
      { radical: '二', strokeCount: 2, reading: 'に', meaning: 'Hai' },
      { radical: '亠', strokeCount: 2, reading: 'なべぶた', meaning: 'Nắp vung' },
      { radical: '人', strokeCount: 2, reading: 'ひと', meaning: 'Người' },
      { radical: '儿', strokeCount: 2, reading: 'にんにょう', meaning: 'Chân người' },
      { radical: '入', strokeCount: 2, reading: 'いる', meaning: 'Vào' },
      { radical: '八', strokeCount: 2, reading: 'はち', meaning: 'Tám' },
      { radical: '冂', strokeCount: 2, reading: 'けいがまえ', meaning: 'Viền bao' },
      { radical: '冖', strokeCount: 2, reading: 'わかんむり', meaning: 'Mũ che' },
      { radical: '冫', strokeCount: 2, reading: 'にすい', meaning: 'Băng / Nước đá' },
      { radical: '几', strokeCount: 2, reading: 'つくえ', meaning: 'Cái bàn' },
      { radical: '凵', strokeCount: 2, reading: 'かんにょう', meaning: 'Khung hở' },
      { radical: '刀', strokeCount: 2, reading: 'かたな', meaning: 'Dao' },
      { radical: '力', strokeCount: 2, reading: 'ちから', meaning: 'Sức mạnh' },
      { radical: '勹', strokeCount: 2, reading: 'つつみがまえ', meaning: 'Bọc / Gói' },
      { radical: '匕', strokeCount: 2, reading: 'さじ', meaning: 'Thìa / Muỗng' },
      { radical: '匚', strokeCount: 2, reading: 'はこがまえ', meaning: 'Hộp' },
      { radical: '匸', strokeCount: 2, reading: 'かくしがまえ', meaning: 'Giấu' },
      { radical: '十', strokeCount: 2, reading: 'じゅう', meaning: 'Mười' },
      { radical: '卜', strokeCount: 2, reading: 'ぼく', meaning: 'Bói' },
      { radical: '卩', strokeCount: 2, reading: 'ふしづくり', meaning: 'Con dấu' },
      { radical: '厂', strokeCount: 2, reading: 'がんだれ', meaning: 'Vách đá' },
      { radical: '厶', strokeCount: 2, reading: 'む', meaning: 'Riêng tư' },
      { radical: '又', strokeCount: 2, reading: 'また', meaning: 'Lại / Tay phải' },
    ],
  },

  // ── 3 nét — Kangxi #30–#60 ──
  {
    sectionKey: '3-stroke',
    sectionLabel: '3 nét',
    description: 'Bộ thủ 3 nét — nền tảng nhận diện kanji thường gặp. Kangxi #30 – #60.',
    items: [
      { radical: '口', strokeCount: 3, reading: 'くち', meaning: 'Miệng' },
      { radical: '囗', strokeCount: 3, reading: 'くにがまえ', meaning: 'Bao vây' },
      { radical: '土', strokeCount: 3, reading: 'つち', meaning: 'Đất' },
      { radical: '士', strokeCount: 3, reading: 'さむらい', meaning: 'Kẻ sĩ' },
      { radical: '夂', strokeCount: 3, reading: 'ふゆがしら', meaning: 'Đi chậm' },
      { radical: '夊', strokeCount: 3, reading: 'すいにょう', meaning: 'Theo sau' },
      { radical: '夕', strokeCount: 3, reading: 'ゆう', meaning: 'Chiều tối' },
      { radical: '大', strokeCount: 3, reading: 'だい', meaning: 'To / Lớn' },
      { radical: '女', strokeCount: 3, reading: 'おんな', meaning: 'Phụ nữ' },
      { radical: '子', strokeCount: 3, reading: 'こ', meaning: 'Con / Trẻ em' },
      { radical: '宀', strokeCount: 3, reading: 'うかんむり', meaning: 'Mái nhà' },
      { radical: '寸', strokeCount: 3, reading: 'すん', meaning: 'Tấc (đơn vị)' },
      { radical: '小', strokeCount: 3, reading: 'しょう', meaning: 'Nhỏ' },
      { radical: '尢', strokeCount: 3, reading: 'まげあし', meaning: 'Chân lệch' },
      { radical: '尸', strokeCount: 3, reading: 'しかばね', meaning: 'Xác / Thân' },
      { radical: '屮', strokeCount: 3, reading: 'てつ', meaning: 'Mầm cây' },
      { radical: '山', strokeCount: 3, reading: 'やま', meaning: 'Núi' },
      { radical: '巛', strokeCount: 3, reading: 'かわ', meaning: 'Sông' },
      { radical: '工', strokeCount: 3, reading: 'こう', meaning: 'Thợ / Công' },
      { radical: '己', strokeCount: 3, reading: 'おのれ', meaning: 'Bản thân' },
      { radical: '巾', strokeCount: 3, reading: 'はば', meaning: 'Khăn / Vải' },
      { radical: '干', strokeCount: 3, reading: 'ほす', meaning: 'Khô / Can' },
      { radical: '幺', strokeCount: 3, reading: 'いとがしら', meaning: 'Nhỏ / Sợi nhỏ' },
      { radical: '广', strokeCount: 3, reading: 'まだれ', meaning: 'Mái che' },
      { radical: '廴', strokeCount: 3, reading: 'えんにょう', meaning: 'Kéo dài' },
      { radical: '廾', strokeCount: 3, reading: 'にじゅうあし', meaning: 'Hai tay' },
      { radical: '弋', strokeCount: 3, reading: 'しきがまえ', meaning: 'Cái cọc' },
      { radical: '弓', strokeCount: 3, reading: 'ゆみ', meaning: 'Cung' },
      { radical: '彐', strokeCount: 3, reading: 'けいがしら', meaning: 'Đầu lợn' },
      { radical: '彡', strokeCount: 3, reading: 'さんづくり', meaning: 'Lông / Sọc' },
      { radical: '彳', strokeCount: 3, reading: 'ぎょうにんべん', meaning: 'Bước đi' },
    ],
  },

  // ── 4 nét — Kangxi #61–#80 ──
  {
    sectionKey: '4-stroke',
    sectionLabel: '4 nét',
    description: 'Bộ thủ 4 nét — liên quan đến tâm trí, vũ khí, cơ thể. Kangxi #61 – #80.',
    items: [
      { radical: '心', strokeCount: 4, reading: 'こころ', meaning: 'Trái tim / Tâm' },
      { radical: '戈', strokeCount: 4, reading: 'ほこ', meaning: 'Giáo / Mác' },
      { radical: '戶', strokeCount: 4, reading: 'と', meaning: 'Cửa / Hộ' },
      { radical: '手', strokeCount: 4, reading: 'て', meaning: 'Tay' },
      { radical: '支', strokeCount: 4, reading: 'しえる', meaning: 'Nhánh / Chống' },
      { radical: '攴', strokeCount: 4, reading: 'のぶん', meaning: 'Đánh nhẹ' },
      { radical: '文', strokeCount: 4, reading: 'ぶん', meaning: 'Văn / Chữ' },
      { radical: '斗', strokeCount: 4, reading: 'とます', meaning: 'Đấu (đong)' },
      { radical: '斤', strokeCount: 4, reading: 'おの', meaning: 'Rìu / Cân' },
      { radical: '方', strokeCount: 4, reading: 'ほう', meaning: 'Phương hướng' },
      { radical: '无', strokeCount: 4, reading: 'なし', meaning: 'Không / Vô' },
      { radical: '日', strokeCount: 4, reading: 'にち', meaning: 'Mặt trời / Ngày' },
      { radical: '曰', strokeCount: 4, reading: 'いわく', meaning: 'Nói rằng' },
      { radical: '月', strokeCount: 4, reading: 'つき', meaning: 'Trăng / Tháng' },
      { radical: '木', strokeCount: 4, reading: 'き', meaning: 'Cây / Gỗ' },
      { radical: '欠', strokeCount: 4, reading: 'あくび', meaning: 'Ngáp / Thiếu' },
      { radical: '止', strokeCount: 4, reading: 'とめる', meaning: 'Dừng' },
      { radical: '歹', strokeCount: 4, reading: 'がつへん', meaning: 'Xương chết' },
      { radical: '殳', strokeCount: 4, reading: 'るまた', meaning: 'Vũ khí đập' },
      { radical: '毋', strokeCount: 4, reading: 'なかれ', meaning: 'Chớ / Đừng' },
    ],
  },
];
