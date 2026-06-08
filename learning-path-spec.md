# Codex Prompt — Lộ trình học cá nhân hóa (Japanese Learning Platform)

> Stack: NestJS · MongoDB (Mongoose) · Vertex AI (Gemini) · React (Frontend)
> Làm tuần tự: Người 1 xong → Người 2 bắt đầu.
> **Sync schema `LearningPath` trước khi bắt đầu.**

> Đã đối chiếu với source hiện tại:
>
> - Backend có global prefix `/api`, global `AuthGuard`, response được wrap dạng `{ success: true, data }`.
> - API user-facing nên lấy `userId` từ `req.user.sub`; không bắt frontend gửi `userId` trong body/path.
> - Backend hiện có sẵn: `JlptWord`, `JlptKanji`, `JlptGrammar`, `Exam`, `ExamResult`, `ExamResultDetail`, `ExamPart`, `ConversationLesson`.
> - Backend chưa có `ReadingPassage` và `WritingExercise`; MVP không query 2 collection này. Nếu muốn giữ skill `reading`/`writing` thật sự thì phải tạo schema + UI/module tương ứng trước.
> - AI có sẵn `AiModule` export `GoogleGenAIClient` và `GeminiProvider`; ưu tiên import `AiModule` và dùng `GoogleGenAIClient.generate()` cho prompt text.

---

## TỔNG QUAN LUỒNG

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER MỚI ĐĂNG KÝ                            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BƯỚC 1 — Màn hình chào mừng (Onboarding)              │
│         Chọn mục tiêu học + "Bạn đã biết tiếng Nhật chưa?"         │
└──────────┬──────────────────────┬──────────────────────┬────────────┘
           │                      │                      │
     Hoàn toàn mới         Đã học một chút        Biết rõ trình độ
           │                      │                      │
           ▼                      ▼                      ▼
      Tự động gán         Placement test          Chọn N5 → N1
          N5               ~20 câu JLPT
                          (vocab + grammar)
                          AI gợi ý level
           │                      │                      │
           └──────────────────────┴──────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BƯỚC 3 — Goal Setup                             │
│     Skill mặc định theo mục tiêu (toggle on/off) · phút/ngày       │
│              Ngày thi JLPT (nếu mục tiêu = jlpt_exam)              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BƯỚC 4 — AI Generate LearningPath                      │
│   Gemini nhận level + goal + content có sẵn → tạo WeeklyPlans      │
│               Lưu LearningPath vào MongoDB                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ╔═════════════════╧══════════════════╗
              ║   NGƯỜI 1 bàn giao — NGƯỜI 2 tiếp  ║
              ╚═════════════════╤══════════════════╝
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BƯỚC 5 — Dashboard                               │
│     "Hôm nay học gì" · Streak · % tiến độ tuần                     │
│   Mỗi task → link đúng route hiện có (jlpt/practice/conversation)   │
│   Hoàn thành bài → PATCH /learning-path/complete-item → streak     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                         (sau 7–14 ngày)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BƯỚC 6 — AI Điều chỉnh lộ trình                   │
│  Thu thập: completionRate · skillStats · streak                     │
│  Nếu goal = jlpt_exam: lấy thêm ExamResult (điểm thi thử,         │
│    xu hướng, phần yếu) → Gemini phân tích → suggest điều chỉnh    │
│  User confirm → apply WeeklyPlan mới vào tuần tiếp theo            │
└─────────────────────────────────────────────────────────────────────┘

Luồng dữ liệu chính:
  GoalType + SkillType → LearningPath (WeeklyPlans) → Dashboard (todayTasks)
                                                     → complete-item (streak)
                                                     → ExamResult → AI review
                                                     → apply-review (WeeklyPlan mới)

Mapping skill → schema/backend/frontend hiện có:
  vocab           →  JlptWord            → frontend /jlpt hoặc /jlpt/flashcards?type=word&level={level}&source=jlpt
  kanji           →  JlptKanji           → frontend /jlpt hoặc /jlpt/flashcards?type=kanji&level={level}&source=jlpt
  grammar         →  JlptGrammar         → frontend /jlpt hoặc /jlpt/flashcards?type=grammar&level={level}&source=jlpt
  jlpt_exam       →  Exam                → frontend /practice/{levelLower}/test/{refId}
  conversation    →  ConversationLesson  → frontend /conversation (chọn lesson bằng slug/id trong trang hiện có)
  reading         →  CHƯA CÓ backend collection/module riêng trong source hiện tại
  writing         →  CHƯA CÓ backend collection/module riêng trong source hiện tại
```

---

## SHARED — Schema cần thống nhất trước (commit vào repo)

Tạo file `src/modules/learning-path/schemas/learning-path.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type GoalType = "jlpt_exam" | "conversation" | "vocabulary" | "writing";

export type SkillType =
  | "vocab"
  | "grammar"
  | "kanji"
  | "reading"
  | "writing"
  | "conversation"
  | "jlpt_exam";

export const GOAL_SKILL_DEFAULTS: Record<GoalType, SkillType[]> = {
  jlpt_exam: ["vocab", "grammar", "kanji", "jlpt_exam"],
  conversation: ["vocab", "kanji", "conversation"],
  vocabulary: ["vocab", "kanji", "grammar"],
  writing: ["kanji", "grammar"],
};

@Schema({ _id: false })
export class WeeklyItem {
  @Prop({ required: true }) skill: SkillType;
  @Prop({ type: Types.ObjectId, required: true }) refId: Types.ObjectId;
  @Prop({ required: true }) refModel: string; // 'JlptWord' | 'JlptKanji' | 'JlptGrammar' | 'Exam' | 'ConversationLesson'
  @Prop() title?: string; // denormalized để dashboard hiển thị nhanh; vẫn populate refId khi cần detail
  @Prop({ required: true }) order: number;
  @Prop({ default: 15 }) estimatedMinutes: number;
  @Prop() completedAt?: Date;
}

@Schema({ _id: false })
export class WeeklyPlan {
  @Prop({ required: true }) week: number;
  @Prop({ type: [WeeklyItem], default: [] }) items: WeeklyItem[];
}

@Schema({ _id: false })
export class LearningGoal {
  @Prop({ required: true }) type: GoalType;
  @Prop() examDate?: Date;
  @Prop({ required: true }) dailyMinutes: number;
  @Prop({ type: [String], required: true }) focusSkills: SkillType[];
}

@Schema({ _id: false })
export class ReviewSuggestion {
  @Prop({ required: true }) type:
    | "speed_up"
    | "slow_down"
    | "focus_skill"
    | "add_review";
  @Prop() skill?: SkillType;
  @Prop({ required: true }) reason: string;
}

@Schema({ _id: false })
export class LastReview {
  @Prop({ required: true }) reviewedAt: Date;
  @Prop({ required: true }) assessment: string;
  @Prop({ type: [ReviewSuggestion], default: [] })
  suggestions: ReviewSuggestion[];
}

@Schema({ timestamps: true })
export class LearningPath {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;
  @Prop({ required: true, enum: ["N5", "N4", "N3", "N2", "N1"] }) level: string;
  @Prop({ type: LearningGoal, required: true }) goal: LearningGoal;
  @Prop({ type: [WeeklyPlan], default: [] }) weeklyPlans: WeeklyPlan[];
  @Prop({ default: 1 }) currentWeek: number;
  @Prop({ default: 0 }) streakDays: number;
  @Prop() lastActiveAt?: Date;
  @Prop({ type: LastReview }) lastReview?: LastReview;
}

export type LearningPathDocument = LearningPath & Document;
export const LearningPathSchema = SchemaFactory.createForClass(LearningPath);
```

---

---

# NGƯỜI 1 — Onboarding → Placement Test → Generate LearningPath

## Nhiệm vụ

Xây dựng toàn bộ luồng từ lúc user mới đăng ký đến khi `LearningPath` được lưu vào DB,
bao gồm cả Frontend.

## Phạm vi

- Backend: toàn bộ nằm trong **`src/modules/learning-path/`** (1 module duy nhất)
  ```
  src/modules/learning-path/
  ├── schemas/
  │   ├── learning-path.schema.ts        ← schema chung đã thống nhất
  │   └── placement-question.schema.ts   ← schema câu hỏi placement
  ├── data/
  │   └── placement-questions.data.ts    ← mock seed placement
  ├── dto/
  │   ├── submit-placement.dto.ts![alt text](image.png)
  │   └── generate-learning-path.dto.ts
  ├── learning-path.module.ts
  ├── learning-path.controller.ts        ← gộp tất cả endpoint bước 1→4
  └── learning-path.service.ts           ← placement logic + generate logic
  ```
- Frontend: `/onboarding` route (các bước chọn mục tiêu → xác định trình độ → goal setup → tạo lộ trình)
- Bàn giao: toàn bộ endpoint bước 1→4 hoạt động + seed `PlacementQuestion` mẫu + UI onboarding hoàn chỉnh

---

## Prompt gửi Codex

````
Dự án: NestJS + MongoDB (Mongoose) + Vertex AI (Gemini) + React
Dùng schema LearningPath đã thống nhất (xem file schema chung).
Nhiệm vụ: Xây dựng luồng Onboarding → Placement Test → Generate LearningPath (backend + frontend)
Tất cả backend nằm trong 1 module duy nhất: src/modules/learning-path/
Đăng ký `LearningPathModule` vào `src/app.module.ts`.
Backend có global prefix `/api`, global AuthGuard và TransformInterceptor wrap response `{ success, data }`.
Các endpoint của LearningPath là endpoint cần đăng nhập, lấy user từ `@Req() req.user.sub`.
Không tạo module `src/placement`; placement nằm chung trong `src/modules/learning-path/`.
Import `AiModule` và dùng `GoogleGenAIClient.generate()` thay vì tạo AI client mới.

Trong `LearningPathModule`, dùng `MongooseModule.forFeature(...)` để đăng ký trực tiếp:
- LearningPath, PlacementQuestion
- JlptWord từ `../jlpt_word/schemas/jlpt_word.schema`
- JlptKanji từ `../jlpt_kanji/schemas/jlpt_kanji.schema`
- JlptGrammar từ `../jlpt_grammar/schemas/jlpt_grammar.schema`
- Exam từ `../exams/schemas/exams.schema`
- ConversationLesson từ `../conversation/schemas/conversation-lesson.schema`

=== BACKEND ===

--- 1. PLACEMENT TEST ---

Tạo schema `PlacementQuestion` tại `src/modules/learning-path/schemas/placement-question.schema.ts`:
- content: string
- options: string[]       // 4 lựa chọn
- correctAnswer: number   // index 0-3
- level: 'N5'|'N4'|'N3'|'N2'|'N1'
- skill: 'vocab'|'grammar'
- explanation: string

Tạo file mock data tại `src/modules/learning-path/data/placement-questions.data.ts` trước tiên:
- 40 câu hỏi thật bằng tiếng Nhật (8 câu mỗi level N5→N1)
- Mix đều vocab và grammar (4 vocab + 4 grammar mỗi level)
- Mỗi câu có đủ: content, options (4 lựa chọn), correctAnswer (index 0-3), level, skill, explanation
- Ví dụ format:

```ts
// src/modules/learning-path/data/placement-questions.data.ts
export const PLACEMENT_QUESTIONS_DATA = [
  {
    content: '___に　なにが　ありますか。',
    options: ['つくえ', 'たべます', 'あおい', 'はやく'],
    correctAnswer: 0,
    level: 'N5',
    skill: 'vocab',
    explanation: '「つくえ」は名詞で、場所に存在するものとして適切です。',
  },
  // ... 39 câu còn lại
]
```

Sau khi có file data, tạo seed service để import vào DB khi khởi động (chỉ seed nếu collection rỗng).

Thêm 2 endpoint placement trong `LearningPathController`:

GET /learning-path/placement/questions?count=20
→ Random 20 câu, đảm bảo có đủ các level và cả 2 skill vocab/grammar

POST /learning-path/placement/submit
Body: { answers: { questionId: string, selected: number }[] }
Response:
{
  suggestedLevel: 'N5'|'N4'|'N3'|'N2'|'N1',
  confidence: number,       // 0.0 - 1.0
  skillBreakdown: {
    vocab: number,          // % đúng
    grammar: number
  },
  levelBreakdown: {         // % đúng từng level
    N5: number, N4: number, N3: number, N2: number, N1: number
  }
}

Logic tính suggestedLevel:
1. Tính % đúng theo từng level (levelBreakdown)
2. Level cao nhất mà user đúng >= 60% → suggestedLevel
3. Nếu nằm ở ranh giới (chênh lệch < 10%) → gọi Gemini phân tích thêm:
   Prompt: "User đúng N3: 62%, N4: 78%. Skill vocab: 70%, grammar: 55%.
            Gợi ý level phù hợp để bắt đầu học và lý do."
4. confidence = độ chênh lệch giữa level được chọn và level kế tiếp (normalize 0-1)

--- 2. GENERATE LEARNING PATH ---

Tạo `LearningPathModule` tại `src/modules/learning-path/`
Dùng schema LearningPath đã thống nhất, không tạo lại.

Endpoint:
POST /learning-path/generate
Body:
{
  level: 'N5'|'N4'|'N3'|'N2'|'N1',
  goal: {
    type: 'jlpt_exam'|'conversation'|'vocabulary'|'writing',
    examDate?: string,        // ISO date, chỉ có khi type = jlpt_exam
    dailyMinutes: number,     // 15 | 30 | 45 | 60
    focusSkills?: SkillType[] // nếu user override default
  }
}

Logic trong service:
0. userId lấy từ `req.user.sub`; validate bằng `Types.ObjectId.isValid`.
1. Nếu focusSkills không truyền → dùng GOAL_SKILL_DEFAULTS[goal.type]
2. Tính số tuần lộ trình:
   - Nếu có examDate → số tuần = khoảng cách từ now đến examDate (tối đa 16 tuần)
   - Nếu không → mặc định 8 tuần
3. Query DB lấy content theo level + focusSkills:
   - vocab         → JlptWord collection, filter `{ level, isDeleted: false }`, title = `word`, refModel = `JlptWord`
   - kanji         → JlptKanji collection, filter `{ level, isDeleted: false }`, title = `kanji`, refModel = `JlptKanji`
   - grammar       → JlptGrammar collection, filter `{ level, isDeleted: false }`, title = `title`, refModel = `JlptGrammar`
   - jlpt_exam     → Exam collection, filter `{ level, status: 'published' }`, title = `title`, refModel = `Exam`
   - conversation  → ConversationLesson collection, filter `{ level, published: true }`, title = `title`, refModel = `ConversationLesson`
   - reading/writing → không query vì source hiện chưa có collection; nếu user toggle 2 skill này thì bỏ qua và trả warning nhẹ trong response
4. Build prompt Gemini:
   """
   Tạo lộ trình học tiếng Nhật {totalWeeks} tuần dạng JSON.
   - Trình độ: {level}
   - Mục tiêu: {goal.type}
   - Skills ưu tiên (theo thứ tự quan trọng): {focusSkills}
   - Thời gian học: {dailyMinutes} phút/ngày
   - Nội dung có sẵn: {availableItems} (mỗi item: { id, skill, refModel, estimatedMinutes, title })

   Yêu cầu:
   - Sắp xếp items hợp lý: vocab/kanji/grammar trước → conversation/exam sau
   - Tổng estimatedMinutes mỗi tuần ≈ {dailyMinutes * 7} phút
   - Phân bổ đều các skill theo focusSkills, skill đầu tiên chiếm nhiều nhất
   - Trả về JSON hợp lệ, không có text thừa:
   {
     "weeklyPlans": [
       {
         "week": 1,
         "items": [
           { "skill": "vocab", "refId": "...", "refModel": "JlptWord", "title": "...", "order": 1, "estimatedMinutes": 10 }
         ]
       }
     ]
   }
   """
5. Parse JSON từ Gemini → lưu LearningPath vào DB
6. Trả về LearningPath document

=== FRONTEND ===

Route: /onboarding (redirect về đây ngay sau đăng ký nếu chưa có LearningPath)
Thêm route trong `src/config/routes.js` và `src/routes/index.jsx`.
Tạo service `src/services/learningPathService.js` dùng `~/apis/configs/httpRequest` hoặc fetch với `credentials: "include"`.
Nhớ unwrap response backend: `const data = res?.data ?? res` vì interceptor trả `{ success, data }`.

Luồng 3 bước dạng wizard (step indicator ở trên):

--- Bước 1: Mục tiêu & trình độ ---
Chọn mục tiêu (1 trong 4, dạng card lớn có icon):
  🎯 Luyện thi JLPT
  💬 Luyện giao tiếp
  📖 Luyện từ vựng
  ✍️  Luyện viết

Chọn tình trạng tiếng Nhật (radio card):
  🌱 Hoàn toàn mới       → tự động gán N5, skip bước placement
  📚 Đã học một chút     → vào placement test
  ✅ Biết rõ trình độ    → hiện dropdown chọn N5→N1

--- Bước 2: Xác định trình độ (tùy nhánh) ---
Nhánh "Hoàn toàn mới":
  → Bỏ qua, chuyển thẳng Bước 3

Nhánh "Biết rõ trình độ":
  → Hiển thị 5 card N5/N4/N3/N2/N1, mỗi card có mô tả ngắn
  → Chọn xong → chuyển Bước 3

Nhánh "Đã học một chút":
  → Hiển thị 20 câu hỏi trắc nghiệm (gọi GET /learning-path/placement/questions?count=20)
  → Mỗi câu: nội dung + 4 lựa chọn, có thanh tiến trình (câu x/20)
  → Sau câu cuối → gọi POST /learning-path/placement/submit
  → Hiển thị kết quả: level gợi ý + confidence + breakdown theo skill
  → Nút "Dùng level này" hoặc "Tự chọn level khác"
  → Chuyển Bước 3

--- Bước 3: Goal setup ---
Hiển thị skill set mặc định theo mục tiêu đã chọn (toggle chip on/off):
  jlpt_exam    → vocab ✓ grammar ✓ kanji ✓ jlpt_exam ✓
  conversation → vocab ✓ kanji ✓ conversation ✓
  vocabulary   → vocab ✓ kanji ✓ grammar ✓
  writing      → kanji ✓ grammar ✓

Ẩn hoặc disable chip `reading` và `writing` với note ngắn "Chưa có nội dung trong hệ thống hiện tại" nếu vẫn muốn hiển thị roadmap tương lai.

Slider: Thời gian học mỗi ngày: 15 / 30 / 45 / 60 phút

Date picker (chỉ hiện nếu mục tiêu = jlpt_exam):
  "Ngày thi JLPT dự kiến" (JLPT thường vào tháng 7 và tháng 12)

Nút "Tạo lộ trình của tôi" → gọi POST /learning-path/generate
→ Hiển thị loading "AI đang tạo lộ trình..."
→ Thành công → redirect /dashboard
````

---

---

# NGƯỜI 2 — Dashboard → Progress Tracking → AI Điều chỉnh lộ trình

## Nhiệm vụ

Xây dựng dashboard hiển thị lộ trình, tracking tiến độ hàng ngày, và AI review định kỳ,
bao gồm cả Frontend.

## Điều kiện bắt đầu

Người 1 đã xong: API `POST /learning-path/generate` hoạt động, có `LearningPath` thật trong DB.

## Phạm vi

- Backend: toàn bộ nằm trong **`src/modules/learning-path/`** (cùng module với Người 1, thêm vào controller/service)
  ```
  src/modules/learning-path/
  ├── schemas/
  │   └── learning-path.schema.ts        ← dùng lại, KHÔNG tạo lại
  ├── dto/
  │   ├── complete-item.dto.ts
  │   └── apply-review.dto.ts
  ├── learning-path.controller.ts        ← thêm endpoint bước 5→6 vào đây
  └── learning-path.service.ts           ← thêm dashboard + progress + review logic
  ```
- Frontend: `/dashboard` route
- Chỉ đọc/cập nhật `LearningPath`, **không tạo lại schema**, import từ `src/modules/learning-path/schemas/learning-path.schema.ts`

---

## Prompt gửi Codex

```
Dự án: NestJS + MongoDB (Mongoose) + Vertex AI (Gemini) + React
Dùng schema LearningPath đã thống nhất (xem file schema chung).
Nhiệm vụ: Dashboard + Progress Tracking + AI điều chỉnh lộ trình (backend + frontend)
Tất cả backend nằm trong cùng module src/modules/learning-path/ — chỉ thêm method vào controller và service có sẵn.
KHÔNG tạo lại schema LearningPath, chỉ import từ src/modules/learning-path/schemas/learning-path.schema.ts
Các endpoint cần đăng nhập, lấy userId từ `req.user.sub`; không nhận `userId` từ path/body.
Nếu cần query ExamResult, đăng ký thêm model `ExamResult`, `ExamResultDetail`, `ExamPart` trong `LearningPathModule` bằng `MongooseModule.forFeature`.
Import `AiModule` và dùng `GoogleGenAIClient.generate()` cho review prompt.

=== BACKEND ===

--- 1. DASHBOARD API ---

GET /learning-path/dashboard
Response:
{
  level: string,
  goal: LearningGoal,
  streakDays: number,
  weekProgress: {
    week: number,
    total: number,
    completed: number,
    percent: number
  },
  todayTasks: WeeklyItem[],
  lastReview?: LastReview,
  daysElapsed: number
}

Logic todayTasks:
1. Lấy weeklyPlans[currentWeek - 1].items
2. Filter những item chưa có completedAt
3. Sort theo order
4. Cộng dồn estimatedMinutes, dừng khi tổng >= dailyMinutes
   (đảm bảo không giao việc vượt quá thời gian user đăng ký)

--- 2. PROGRESS TRACKING ---

PATCH /learning-path/complete-item
Body: { refId: string, skill: SkillType }

Logic:
1. Lấy userId từ `req.user.sub`, tìm LearningPath active của userId
2. Tìm item trong weeklyPlans[currentWeek-1].items khớp refId + skill
3. Set completedAt = new Date()
4. Cập nhật streak:
   - lastActiveAt là hôm qua → streakDays++
   - lastActiveAt là hôm nay → giữ nguyên
   - Cách hơn 1 ngày → reset streakDays = 1
5. lastActiveAt = now
6. Nếu TẤT CẢ items trong tuần đã completedAt → currentWeek++
7. Save, trả về LearningPath updated

--- 3. AI ĐIỀU CHỈNH LỘ TRÌNH ---

POST /learning-path/review

Trigger: Gọi thủ công khi user bấm "Xem AI đánh giá",
hoặc tự động sau 7 ngày kể từ createdAt (dùng cron job nếu có).

Logic trong service:

Bước 1 — Thu thập dữ liệu học tập:
  a. Từ LearningPath:
     - completionRate: % items đã completedAt / tổng items đã qua (theo tuần)
     - skillStats: % hoàn thành từng skill trong focusSkills
     - streakDays, currentWeek
     - daysElapsed: số ngày kể từ createdAt

  b. Nếu goal.type = 'jlpt_exam': truy vấn thêm ExamResult của userId:
     - Lấy tất cả ExamResult trong khoảng thời gian học (từ createdAt đến now)
     - Populate/join details → ExamResultDetail → ExamPart
     - Map part hiện có:
       "Từ vựng" → vocab
       "Ngữ pháp - Đọc hiểu" → grammar_reading
       "Thi nghe" hoặc "Nghe hiểu" → listening
     - Tổng hợp: số lần thi, điểm trung bình từng phần, xu hướng tăng/giảm qua các lần thi, phần yếu nhất

Bước 2 — Build prompt Gemini:
  Nếu goal.type = 'jlpt_exam':
  """
  User đang luyện thi JLPT {level} với lộ trình {totalWeeks} tuần.
  Skills đang focus: {focusSkills}

  Tiến độ lộ trình sau {daysElapsed} ngày:
  - Tuần hiện tại: {currentWeek}/{totalWeeks}
  - Tỉ lệ hoàn thành bài học: {completionRate}%
  - Theo từng skill: {skillStats}
  - Streak: {streakDays} ngày liên tiếp

  Kết quả thi thử JLPT trên hệ thống:
  - Số lần thi: {examCount}
  - Điểm trung bình: vocab {avgVocab}%, grammar_reading {avgGrammarReading}%, listening {avgListening}%
  - Xu hướng: {trend} (tăng/giảm/ổn định)
  - Phần yếu nhất: {weakestPart}
  - Lần thi gần nhất: {lastExamScore}

  Dựa trên dữ liệu trên, hãy:
  1. Đánh giá tiến độ có đúng schedule không (so với {totalWeeks} tuần và examDate {examDate})
  2. Xác định skill/phần thi nào cần tăng cường gấp
  3. Đề xuất điều chỉnh lộ trình tuần tiếp theo

  Trả về JSON hợp lệ, không có text thừa:
  {
    "assessment": "...",
    "onTrack": true|false,
    "suggestions": [
      { "type": "focus_skill", "skill": "grammar", "reason": "..." },
      { "type": "add_review",  "skill": "vocab",   "reason": "..." }
    ],
    "adjustedWeeklyItems": [
      { "skill": "grammar", "refId": "...", "refModel": "JlptGrammar", "title": "...", "order": 1, "estimatedMinutes": 20 }
    ]
  }
  """

  Nếu goal.type khác (conversation / vocabulary / writing):
  """
  User đang học tiếng Nhật mục tiêu {goal.type}, trình độ {level}.
  Skills focus: {focusSkills}

  Tiến độ sau {daysElapsed} ngày:
  - Tỉ lệ hoàn thành: {completionRate}%
  - Theo từng skill: {skillStats}
  - Streak: {streakDays} ngày

  Đánh giá và đề xuất điều chỉnh phù hợp.
  Trả về JSON cùng format ở trên (không có trường examResult).
  """

Bước 3 — Xử lý response:
  1. Parse JSON từ Gemini
  2. Lưu vào lastReview: { reviewedAt: now, assessment, suggestions }
  3. Trả về { assessment, onTrack, suggestions, adjustedWeeklyItems }

PATCH /learning-path/apply-review
Body: { confirmedItems: WeeklyItem[] }
→ Thay thế weeklyPlans[currentWeek].items bằng confirmedItems
→ Trả về LearningPath updated

=== FRONTEND ===

Route: /dashboard
Tận dụng route `config.routes.dashboard` hiện có. Có thể thay nội dung page `src/pages/Dashboard/index.jsx` hoặc tách component con.
Tạo/extend `src/services/learningPathService.js`:
- `getLearningPathDashboard()` → GET `/learning-path/dashboard`
- `completeLearningPathItem(body)` → PATCH `/learning-path/complete-item`
- `reviewLearningPath()` → POST `/learning-path/review`
- `applyLearningPathReview(body)` → PATCH `/learning-path/apply-review`
Nhớ unwrap `{ success, data }`.

--- Layout chính ---
Header:
  "Xin chào {name} 👋"
  Streak badge: 🔥 {streakDays} ngày

Card tiến độ tuần:
  "Tuần {currentWeek}" · Progress bar: {completed}/{total} bài · {percent}%
  Label: "Hoàn thành {percent}% kế hoạch tuần này"

--- Section "Hôm nay học gì" ---
List todayTasks, mỗi item hiển thị:
  - Icon skill (🔤 vocab / 📝 grammar / 🖊 kanji / 📖 reading / 🗣 conversation / 📋 jlpt_exam)
  - Tên bài học (populate từ refId)
  - Badge: "{estimatedMinutes} phút"
  - Nút "Bắt đầu" → navigate theo skill:
      vocab         → /jlpt/flashcards?type=word&level={level}&source=jlpt
      kanji         → /jlpt/flashcards?type=kanji&level={level}&source=jlpt
      grammar       → /jlpt/flashcards?type=grammar&level={level}&source=jlpt
      jlpt_exam     → /practice/{levelLower}/test/{refId}
      conversation  → /conversation
      reading       → không enable trong MVP vì chưa có route/module backend
      writing       → không enable trong MVP vì chưa có route/module backend

Sau khi user hoàn thành bài học trong module tương ứng,
module đó gọi PATCH /learning-path/complete-item
rồi redirect về /dashboard.

Item đã completedAt hiển thị dạng strikethrough + icon ✅, không có nút Bắt đầu.

--- Section "Đánh giá lộ trình" ---
Điều kiện hiển thị: daysElapsed >= 7 hoặc user chủ động bấm

Trạng thái chưa review:
  Card với nút "Xem AI đánh giá tiến độ"
  → Gọi POST /learning-path/review
  → Loading: "AI đang phân tích kết quả học tập..."

Trạng thái đã có review (lastReview):
  - Badge: onTrack = true → "✅ Đúng tiến độ" / false → "⚠️ Cần điều chỉnh"
  - Paragraph: assessment
  - List suggestions (mỗi item: icon + reason)
    speed_up    → ⚡ "Có thể học nhanh hơn"
    slow_down   → 🐢 "Nên ôn lại trước khi tiếp"
    focus_skill → 🎯 "{skill}: {reason}"
    add_review  → 🔁 "Ôn tập: {reason}"
  - Nút "Áp dụng điều chỉnh" → gọi PATCH /learning-path/apply-review
    với body { confirmedItems: adjustedWeeklyItems }
  - Nút "Giữ nguyên lộ trình"
```

---

## Bàn giao & Merge

|                 | Người 1                            | Người 2                                                                                                                                   |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Backend         | `POST /learning-path/generate` ✓   | `GET /learning-path/dashboard`, `PATCH /learning-path/complete-item`, `POST /learning-path/review`, `PATCH /learning-path/apply-review` ✓ |
| Frontend        | `/onboarding` wizard hoàn chỉnh ✓  | `/dashboard` hoàn chỉnh ✓                                                                                                                 |
| Test end-to-end | Onboarding → tạo xong LearningPath | Dashboard → complete item → AI review → apply                                                                                             |

Merge point: Chạy luồng hoàn chỉnh: đăng ký → onboarding → dashboard → học bài → review sau 7 ngày.
