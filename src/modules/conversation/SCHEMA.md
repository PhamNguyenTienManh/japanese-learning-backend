# Conversation Module – Cập nhật Schema MongoDB

Tài liệu này hướng dẫn bổ sung các trường/collection cần thiết để màn **Luyện hội thoại**
mới (Từ vựng & ngữ pháp + Luyện nói với phụ đề) hoạt động đầy đủ.

## 1. Tổng quan

Module dùng 2 collection:

| Collection                | Vai trò                          |
| ------------------------- | -------------------------------- |
| `conversation_categories` | Chủ đề (Chào hỏi, Mua sắm, ...)  |
| `conversation_lessons`    | Bài hội thoại thuộc 1 chủ đề     |

Bản mới **không thêm collection**, chỉ **bổ sung trường** vào `conversation_lessons`.

## 2. `conversation_categories` (giữ nguyên)

```jsonc
{
  "_id": ObjectId,
  "id": "greeting",        // mã ổn định, dùng để liên kết với lesson
  "slug": "greeting",
  "title": "Chào hỏi",
  "order": 1,
  "isActive": true,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

## 3. `conversation_lessons` (BỔ SUNG)

Các trường **mới** được đánh dấu 🆕.

```jsonc
{
  "_id": ObjectId,
  "category": {
    "id": "greeting",
    "title": "Chào hỏi",
    "order": 1
  },
  "slug": "rat-vui-duoc-gap-ban",
  "level": "N5",
  "title": "Rất vui được gặp bạn!",
  "image": "https://...",
  "order": 1,
  "published": true,

  // Mô tả tình huống – hiển thị ở khối "Trình tự hội thoại"
  "description": "Bạn được Sato, một người quen trong bữa tiệc, tới chào hỏi. Hãy chào đáp lại.",

  // Các câu hội thoại CỐ ĐỊNH, xen kẽ theo thứ tự:
  //   index chẵn (câu 1, 3, 5...) -> B (đối phương, bên trái) đọc trước
  //   index lẻ  (câu 2, 4, 6...) -> A (người học, bên phải) đọc mẫu rồi user nói lại
  // Không cần lưu trường speaker, vai trò suy ra theo thứ tự.
  "lines": [
    {
      "order": 1,
      "japanese": "アンさん、こんにちは。パーティー、楽しいですか？",
      "kana": "アンさん、こんにちは。パーティー、たのしいですか？",
      "vietnamese": "Chào An. Bữa tiệc vui chứ?"
    },
    {
      "order": 2,
      "japanese": "あ、佐藤さん、こんにちは。",
      "kana": "あ、さとうさん、こんにちは。",
      "vietnamese": "A, Sato, xin chào."
    }
  ],

  // 🆕 Từ vựng của bài – hiển thị tab "Từ vựng"
  "vocabulary": [
    {
      "order": 1,
      "word": "楽しい",        // từ (kanji/kana)
      "furigana": "たのしい",  // cách đọc
      "meaning": "Vui vẻ"      // nghĩa tiếng Việt
    }
  ],

  // 🆕 Ngữ pháp của bài – hiển thị tab "Ngữ pháp"
  "grammar": [
    {
      "order": 1,
      "title": "～は～です",                 // mẫu ngữ pháp
      "meaning": "Diễn tả 'A là B' (lịch sự)",
      "example": "わたしは学生です。",        // câu ví dụ (tùy chọn)
      "exampleMeaning": "Tôi là học sinh."    // nghĩa ví dụ (tùy chọn)
    }
  ],

  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### Bảng trường mới

| Trường                    | Kiểu     | Bắt buộc | Mặc định | Ghi chú                                        |
| ------------------------- | -------- | -------- | -------- | ---------------------------------------------- |
| `description`             | string   | Không    | `""`     | Mô tả tình huống hội thoại                     |
| `vocabulary[]`            | array    | Không    | `[]`     | Danh sách từ vựng                              |
| `vocabulary[].order`      | number   | Không    | `0`      | Thứ tự                                         |
| `vocabulary[].word`       | string   | Có\*     | —        | Bắt buộc nếu phần tử tồn tại                   |
| `vocabulary[].furigana`   | string   | Không    | `""`     | Cách đọc                                       |
| `vocabulary[].meaning`    | string   | Không    | `""`     | Nghĩa tiếng Việt                               |
| `grammar[]`               | array    | Không    | `[]`     | Danh sách ngữ pháp                             |
| `grammar[].order`         | number   | Không    | `0`      | Thứ tự                                         |
| `grammar[].title`         | string   | Có\*     | —        | Bắt buộc nếu phần tử tồn tại                   |
| `grammar[].meaning`       | string   | Không    | `""`     | Nghĩa/giải thích                               |
| `grammar[].example`       | string   | Không    | `""`     | Câu ví dụ                                      |
| `grammar[].exampleMeaning`| string   | Không    | `""`     | Nghĩa câu ví dụ                                |

> \* "Có\*" nghĩa là bắt buộc khi phần tử mảng được tạo, không phải bắt buộc ở cấp lesson.

## 4. Migration dữ liệu cũ

Các trường mới đều có mặc định nên **không cần migration bắt buộc**. Nếu muốn khởi tạo
sẵn để đồng bộ kiểu dữ liệu, chạy trong `mongosh`:

```js
use japanese_learning   // đổi theo tên DB thực tế (xem MONGO_URI trong .env)

db.conversation_lessons.updateMany(
  { description: { $exists: false } },
  { $set: { description: "" } }
);

db.conversation_lessons.updateMany(
  { vocabulary: { $exists: false } },
  { $set: { vocabulary: [] } }
);

db.conversation_lessons.updateMany(
  { grammar: { $exists: false } },
  { $set: { grammar: [] } }
);
```

## 5. Ví dụ chèn 1 bài hoàn chỉnh

```js
db.conversation_lessons.insertOne({
  category: { id: "greeting", title: "Chào hỏi", order: 1 },
  slug: "rat-vui-duoc-gap-ban",
  level: "N5",
  title: "Rất vui được gặp bạn!",
  image: "https://example.com/greeting.jpg",
  order: 1,
  published: true,
  description: "Bạn được Sato, một người quen trong bữa tiệc, tới chào hỏi. Hãy chào đáp lại.",
  lines: [
    { order: 1, japanese: "アンさん、こんにちは。", kana: "アンさん、こんにちは。", vietnamese: "Chào An." },
    { order: 2, japanese: "こんにちは。", kana: "こんにちは。", vietnamese: "Xin chào." }
  ],
  vocabulary: [
    { order: 1, word: "楽しい", furigana: "たのしい", meaning: "Vui vẻ" },
    { order: 2, word: "パーティー", furigana: "パーティー", meaning: "Bữa tiệc" }
  ],
  grammar: [
    { order: 1, title: "～は～です", meaning: "Diễn tả 'A là B'", example: "わたしは学生です。", exampleMeaning: "Tôi là học sinh." }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## 6. API liên quan

| Method | Endpoint                              | Mô tả                       |
| ------ | ------------------------------------- | --------------------------- |
| GET    | `/conversation`                       | Danh sách nhóm + bài (public) |
| GET    | `/conversation/:idOrSlug`             | Chi tiết 1 bài (public)     |
| GET    | `/conversation/admin/all`             | Toàn bộ data (admin)        |
| POST   | `/conversation/admin/lessons`         | Tạo bài                     |
| PATCH  | `/conversation/admin/lessons/:id`     | Cập nhật bài                |
| DELETE | `/conversation/admin/lessons/:id`     | Xóa bài                     |

`GET /conversation/:idOrSlug` trả thêm `description`, `vocabulary`, `grammar` sau khi
cập nhật (xem `conversation.service.ts#getDetail`). Vai trò người nói trong màn chat
được suy theo thứ tự câu (chẵn = B, lẻ = A), không lưu trong DB.
