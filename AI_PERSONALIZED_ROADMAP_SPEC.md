# Spec: AI Personalized Learning Roadmap

## 1. Mục tiêu

Xây dựng chức năng tạo lộ trình học tiếng Nhật cá nhân hoá cho từng user bằng AI. User có thể khai báo mục tiêu học, trình độ hiện tại, thời gian học mỗi ngày, deadline và kỹ năng muốn ưu tiên; hệ thống dùng dữ liệu hồ sơ + hoạt động học hiện có để đề xuất roadmap theo tuần/ngày, lưu lại để user theo dõi và cập nhật tiến độ.

## 2. Luồng hoạt động tổng thể

Flow chính bám theo sơ đồ `personalized_learning_path_flow.svg`: onboarding user mới, rẽ nhánh theo trạng thái biết trình độ, sinh roadmap bằng AI, học hằng ngày theo module, kiểm tra tiến độ định kỳ và điều chỉnh roadmap.

### 2.1 Sơ đồ onboarding user mới

```text
User mới đăng ký
  |
  v
Màn hình chào mừng
  - Hỏi mục tiêu học tiếng Nhật
  - Hỏi user đã biết tiếng Nhật/trình độ hiện tại chưa
  |
  v
Bạn đã biết trình độ của mình?
  |
  +-- Có
  |     |
  |     v
  |   Chọn cấp JLPT hiện tại
  |     - N5, N4, N3, N2, N1
  |     - currentLevel = cấp user chọn
  |     |
  |     v
  |   Cài đặt mục tiêu
  |
  +-- Hoàn toàn mới
  |     |
  |     v
  |   Bắt đầu từ N5
  |     - currentLevel = beginner hoặc N5 theo implementation
  |     - Không cần placement test
  |     |
  |     v
  |   Cài đặt mục tiêu
  |
  +-- Chưa biết / không chắc
        |
        v
      Làm bài kiểm tra placement test khoảng 20 câu
        |
        v
      Kết quả test
        - Hệ thống/AI gợi ý cấp phù hợp
        - User có thể chấp nhận hoặc chỉnh lại cấp
        |
        v
      Cài đặt mục tiêu
```

### 2.2 Luồng cài đặt mục tiêu và generate roadmap

```text
Cài đặt mục tiêu
  |
  v
User nhập:
  - Thời gian học mỗi ngày
  - Kỳ thi/mục tiêu JLPT muốn đạt
  - Deadline nếu có
  - Kỹ năng ưu tiên: từ vựng, ngữ pháp, kanji, đọc, viết, nghe/nói, luyện thi
  |
  +-- Input thiếu hoặc không hợp lệ
  |     |
  |     v
  |   FE hiển thị lỗi tại field, không gọi generate
  |
  +-- Input hợp lệ
        |
        v
      FE gọi POST /learning-roadmaps/generate
        |
        v
      AI tạo lộ trình cá nhân hóa
        - Dựa trên trình độ hiện tại
        - Dựa trên mục tiêu/kỳ thi
        - Dựa trên lịch học mỗi ngày
        - Dựa trên kỹ năng ưu tiên
        |
        +-- AI/API lỗi
        |     |
        |     v
        |   Hiển thị lỗi thân thiện, giữ nguyên input, cho phép thử lại
        |
        +-- Thành công
              |
              v
            Lưu roadmap active cho user
              |
              v
            Chuyển sang Dashboard lộ trình
```

### 2.3 Luồng user đã từng đăng nhập / đã có roadmap

```text
User đăng nhập và vào /roadmap
  |
  v
FE gọi GET /learning-roadmaps/me
  |
  +-- Không có roadmap active
  |     |
  |     v
  |   Hiển thị onboarding/cài đặt mục tiêu theo flow 2.1
  |
  +-- Có roadmap active
        |
        v
      Hiển thị Dashboard lộ trình ngay
        - Tuần hiện tại
        - Bài học hôm nay
        - % tiến độ
        - CTA tiếp tục học
        - CTA điều chỉnh/tạo lại lộ trình
```

### 2.4 Dashboard lộ trình

```text
Dashboard lộ trình
  |
  v
Hiển thị các vùng chính:
  - Tổng quan mục tiêu: trình độ hiện tại, target JLPT, deadline, dailyMinutes
  - Tuần hiện tại: week title, goal, ngày đang học
  - Bài học hôm nay: danh sách task cần làm
  - % tiến độ: completed task / total task
  - Module học hằng ngày
  |
  +-- User chọn task Từ vựng
  |     |
  |     v
  |   Mở module từ vựng / flashcard / SRS theo task roadmap
  |
  +-- User chọn task Ngữ pháp
  |     |
  |     v
  |   Mở module JLPT grammar theo level/task roadmap
  |
  +-- User chọn task Luyện đọc
  |     |
  |     v
  |   Mở đoạn văn/bài đọc theo level/task roadmap
  |
  +-- User chọn task Luyện viết
        |
        v
      Mở bài luyện Hiragana/Kanji/writing theo task roadmap
```

### 2.5 Luồng hoàn thành task và cập nhật tiến độ

```text
User hoàn thành hoạt động học trong module
  |
  v
Module trả kết quả hoàn thành về roadmap
  |
  v
FE gọi PATCH /learning-roadmaps/:roadmapId/progress
  |
  +-- Thành công
  |     |
  |     v
  |   Cập nhật completedTaskKeys
  |     |
  |     v
  |   Dashboard cập nhật % tiến độ và bài học tiếp theo
  |
  +-- Thất bại
        |
        v
      Rollback trạng thái task, hiển thị lỗi
```

### 2.6 Kiểm tra tiến độ định kỳ và điều chỉnh roadmap

```text
Sau 7-14 ngày học hoặc khi đủ dữ liệu tiến độ
  |
  v
Kiểm tra tiến độ định kỳ
  - Số task đã hoàn thành
  - Tốc độ học so với plan
  - Kết quả quiz/mock test nếu có
  - Module/kỹ năng user yếu
  |
  v
AI đánh giá lại roadmap
  |
  +-- User đang đúng tiến độ
  |     |
  |     v
  |   Giữ roadmap hiện tại, gợi ý bài học tiếp theo
  |
  +-- User chậm tiến độ hoặc yếu một kỹ năng
  |     |
  |     v
  |   Đề xuất điều chỉnh lộ trình
  |     - Giảm tải daily tasks
  |     - Dời milestone
  |     - Tăng task cho kỹ năng yếu
  |     |
  |     v
  |   FE gọi POST /learning-roadmaps/:roadmapId/regenerate nếu user xác nhận
  |
  +-- User đã hoàn thành giai đoạn hiện tại
        |
        v
      Chuyển sang luyện thi JLPT thực chiến
        - Mock test
        - AI phân tích kết quả
        - Đề xuất roadmap giai đoạn tiếp theo
```

### 2.7 Luồng luyện thi JLPT thực chiến

```text
Roadmap đạt đến giai đoạn luyện thi
  |
  v
Dashboard ưu tiên task exam/mock test
  |
  v
User làm mock test
  |
  v
Hệ thống lưu kết quả và phân tích
  |
  v
AI dùng kết quả để:
  - Cập nhật điểm yếu theo kỹ năng
  - Gợi ý nội dung ôn tập
  - Điều chỉnh roadmap nếu cần
```

### 2.8 Luồng bảo mật và ownership

```text
Mọi request roadmap/onboarding/progress
  |
  v
BE lấy userId từ req.user.sub
  |
  +-- Request có roadmapId
  |     |
  |     v
  |   Service tìm roadmap theo _id + userId
  |     |
  |     +-- Không thấy -> trả 404/403, không tiết lộ roadmap của user khác
  |     +-- Tìm thấy -> cho phép update/read
  |
  +-- Request generate/me/placement
        |
        v
      Chỉ đọc/tạo dữ liệu thuộc user hiện tại
```

## 3. Phạm vi

### In scope

- Thêm trang FE mới cho onboarding và dashboard lộ trình cá nhân hoá.
- Tạo module BE mới để lưu onboarding state, roadmap, progress và regenerate roadmap theo user đăng nhập.
- Tích hợp AI để sinh roadmap có cấu trúc JSON ổn định từ trình độ, mục tiêu, lịch học và kỹ năng ưu tiên.
- Hỗ trợ 3 nhánh onboarding: user biết trình độ, user hoàn toàn mới, user cần placement test.
- Dashboard hiển thị tuần hiện tại, bài học hôm nay, module học hằng ngày và % tiến độ.
- User chỉ thao tác được roadmap của chính mình thông qua JWT hiện tại.

### Out of scope

- Không tự động đăng ký lịch học vào calendar bên ngoài.
- Không làm recommendation realtime sau mỗi câu hỏi luyện tập.
- Không thay đổi logic bài thi, từ vựng, notebook, streak hiện tại nếu không cần thiết cho context AI.

## 4. Contract để 2 fullstack làm độc lập

Hai người làm song song theo contract bên dưới. Mỗi người có thể tự mock phần còn lại để không chờ code của nhau.

### 4.1 Response wrapper

Backend hiện có global interceptor wrap response thành:

```json
{
  "success": true,
  "data": {}
}
```

Frontend service phải unwrap theo pattern:

```js
const payload = response?.success ? response.data : response;
```

### 4.2 Roadmap object contract

```json
{
  "_id": "roadmapId",
  "userId": "userId",
  "currentLevel": "N5",
  "targetLevel": "N4",
  "goal": "Thi JLPT N4 trong 3 tháng",
  "dailyMinutes": 60,
  "targetDate": "2026-09-30T00:00:00.000Z",
  "focusSkills": ["vocabulary", "grammar", "kanji"],
  "plan": {
    "summary": "...",
    "milestones": [
      {
        "title": "Nắm nền tảng N4",
        "description": "...",
        "weekFrom": 1,
        "weekTo": 2
      }
    ],
    "weeks": [
      {
        "week": 1,
        "title": "Tuần 1",
        "goal": "Ôn N5 và bắt đầu N4",
        "days": [
          {
            "day": 1,
            "title": "Ngày 1",
            "tasks": [
              {
                "key": "w1-d1-t1",
                "type": "vocabulary",
                "title": "Học 20 từ N4",
                "description": "...",
                "estimatedMinutes": 20
              }
            ]
          }
        ]
      }
    ]
  },
  "progress": {
    "completedTaskKeys": ["w1-d1-t1"],
    "completedWeeks": [],
    "lastUpdatedAt": "2026-06-06T00:00:00.000Z"
  },
  "status": "active",
  "generatedAt": "2026-06-06T00:00:00.000Z",
  "createdAt": "2026-06-06T00:00:00.000Z",
  "updatedAt": "2026-06-06T00:00:00.000Z"
}
```

Rule bắt buộc:

- Mỗi task phải có `key` ổn định theo format `w<week>-d<day>-t<index>` để FE update progress không phụ thuộc Mongo subdocument id.
- `plan.weeks[].days[].tasks[].estimatedMinutes` là number dương.
- Tổng estimatedMinutes trong một ngày không nên vượt quá `dailyMinutes + 15`; nếu AI trả vượt, BE phải normalize hoặc reject trước khi lưu.
- FE phải xử lý được `plan.weeks` rỗng bằng empty state, không crash.

### 4.3 API contract

Base resource: `/learning-roadmaps`.

| Method | Endpoint | Request | Response data |
| --- | --- | --- | --- |
| `GET` | `/learning-roadmaps/me` | none | `LearningRoadmap | null` |
| `POST` | `/learning-roadmaps/placement/submit` | `SubmitPlacementDto` | `PlacementResult` |
| `POST` | `/learning-roadmaps/generate` | `GenerateLearningRoadmapDto` | `LearningRoadmap` |
| `PATCH` | `/learning-roadmaps/:roadmapId/progress` | `UpdateRoadmapProgressDto` | `LearningRoadmap` |
| `POST` | `/learning-roadmaps/:roadmapId/progress-review` | none hoặc `{ force?: boolean }` | `ProgressReviewResult` |
| `POST` | `/learning-roadmaps/:roadmapId/regenerate` | `GenerateLearningRoadmapDto` hoặc `RegenerateRoadmapDto` | `LearningRoadmap` |
| `PATCH` | `/learning-roadmaps/:roadmapId/archive` | none | `{ archived: true, roadmapId: string }` |

`GenerateLearningRoadmapDto`:

```ts
{
  currentLevel: 'beginner' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  targetLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  goal: string;
  dailyMinutes: number;
  targetDate?: string;
  focusSkills: Array<'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening' | 'speaking' | 'exam'>;
}
```

`SubmitPlacementDto`:

```ts
{
  answers: Array<{
    questionId: string;
    selectedAnswer: string;
  }>;
}
```

`PlacementResult`:

```ts
{
  suggestedLevel: 'beginner' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  score: number;
  totalQuestions: number;
  skillBreakdown?: Record<string, number>;
}
```

`UpdateRoadmapProgressDto`:

```ts
{
  completedTaskKeys: string[];
  completedWeeks?: number[];
  sourceModule?: 'vocabulary' | 'grammar' | 'reading' | 'writing' | 'exam' | 'manual';
}
```

`ProgressReviewResult`:

```ts
{
  status: 'on_track' | 'behind' | 'ahead' | 'needs_adjustment';
  summary: string;
  weakSkills: string[];
  recommendation: string;
  shouldRegenerate: boolean;
}
```

## 5. Convention hiện tại cần tuân thủ

### Frontend

- Project FE nằm trong `japanese-learning-frontend` và dùng React JSX.
- Route được khai báo trong `src/config/routes.js` và map page trong `src/routes/index.jsx`.
- Page đặt theo convention `src/pages/<Feature>/index.jsx`.
- Service API đặt trong `src/services/<feature>Service.js`.
- API request hiện có dùng `fetch` với `credentials: "include"` ở `aiService.js` hoặc axios wrapper từ `src/apis/configs/httpRequest.js`; với feature này ưu tiên dùng axios wrapper nếu phù hợp, trừ khi cần streaming.
- Dùng `REACT_APP_BASE_URL` / `REACT_APP_BASE_URL_API` đúng pattern hiện tại, không hardcode URL.
- Styling bám palette hiện tại: teal `#00879a` và orange `#fc5f00`; ưu tiên CSS variables trong `GlobalStyle.scss`, không hardcode màu indigo.
- Tránh icon trang trí cạnh title/label, tránh per-item check icon và watermark kanji.

### Backend

- Project BE nằm trong `japanese-learning-backend` và dùng NestJS + Mongoose.
- Module đặt trong `src/modules/<feature>` gồm controller, service, module, dto, schemas.
- Controller dùng `@Controller('<resource>')`, lấy user qua `@Req() req` và `req.user.sub` do `AuthGuard` global xử lý.
- Schema dùng `@Schema({ timestamps: true, collection: '<collection_name>' })`, `@Prop`, `SchemaFactory.createForClass`.
- Đăng ký schema bằng `MongooseModule.forFeature` trong module feature.
- Đăng ký module mới vào `src/app.module.ts`.
- Response trả data trực tiếp từ controller/service; global interceptor sẽ wrap thành `{ success: true, data }`.
- AI integration nên tận dụng `AiModule`/agent/service hiện có nếu phù hợp thay vì tạo provider rời rạc.

## 6. Data model đề xuất

### Collection: `ai_learning_roadmaps`

Schema đề xuất: `src/modules/learning_roadmaps/schemas/learning_roadmap.schema.ts`.

```ts
@Schema({ timestamps: true, collection: 'ai_learning_roadmaps' })
export class LearningRoadmap extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1', 'beginner'], default: 'beginner' })
  currentLevel: string;

  @Prop({ type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1'], required: true })
  targetLevel: string;

  @Prop({ type: String, required: true })
  goal: string;

  @Prop({ type: Number, required: true })
  dailyMinutes: number;

  @Prop({ type: Date, default: null })
  targetDate?: Date | null;

  @Prop({ type: [String], default: [] })
  focusSkills: string[];

  @Prop({ type: Object, required: true })
  plan: {
    summary: string;
    milestones: Array<{
      title: string;
      description: string;
      weekFrom: number;
      weekTo: number;
    }>;
    weeks: Array<{
      week: number;
      title: string;
      goal: string;
      days: Array<{
        day: number;
        title: string;
        tasks: Array<{
          key: string;
          type: 'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening' | 'speaking' | 'review' | 'exam';
          title: string;
          description: string;
          estimatedMinutes: number;
        }>;
      }>;
    }>;
  };

  @Prop({ type: Object, default: {} })
  progress: {
    completedTaskKeys?: string[];
    completedWeeks?: number[];
    lastUpdatedAt?: Date;
  };

  @Prop({ type: String, enum: ['active', 'archived'], default: 'active' })
  status: string;

  @Prop({ type: Date, default: null })
  generatedAt?: Date | null;
}
```

Index cần có:

```ts
LearningRoadmapSchema.index({ userId: 1, status: 1, updatedAt: -1 });
LearningRoadmapSchema.index({ userId: 1, createdAt: -1 });
```

## 7. AI prompt/output contract

AI phải trả JSON parse được, không trả markdown tự do. Service chịu trách nhiệm parse, validate shape và chỉ lưu khi output hợp lệ.

Context nên đưa vào prompt:

- Profile user từ `profiles` nếu có: tên, level/mục tiêu nếu hiện có.
- Kết quả học/thi gần đây nếu có thể lấy từ `exam_results`, `user_activities`, `user_words`, `user_study_day`.
- Input form của user.
- Ràng buộc thời gian học mỗi ngày và target date.

Output bắt buộc:

```json
{
  "summary": "...",
  "milestones": [
    { "title": "...", "description": "...", "weekFrom": 1, "weekTo": 2 }
  ],
  "weeks": [
    {
      "week": 1,
      "title": "...",
      "goal": "...",
      "days": [
        {
          "day": 1,
          "title": "...",
          "tasks": [
            {
              "key": "w1-d1-t1",
              "type": "vocabulary",
              "title": "...",
              "description": "...",
              "estimatedMinutes": 20
            }
          ]
        }
      ]
    }
  ]
}
```

## 8. UI/UX đề xuất

Route mới: `/roadmap`.

FE files đề xuất:

- `src/pages/Roadmap/index.jsx`
- `src/pages/Roadmap/Roadmap.module.scss` hoặc style file theo pattern page hiện tại
- `src/services/roadmapService.js`
- Update `src/config/routes.js`
- Update `src/routes/index.jsx`

### Màn 1: Welcome / Onboarding

Mục đích: dẫn user mới vào đúng nhánh theo sơ đồ.

Nội dung:

- Tiêu đề chào mừng user mới học tiếng Nhật.
- Câu hỏi mục tiêu học: JLPT, giao tiếp, đọc hiểu, học từ đầu, mục tiêu tự do.
- Câu hỏi `Bạn đã biết trình độ của mình?` với 3 lựa chọn:
  - `Có, tôi biết trình độ` -> chọn cấp JLPT hiện tại.
  - `Tôi hoàn toàn mới` -> gán beginner/N5.
  - `Chưa chắc` -> vào placement test.

Acceptance Criteria:

- Given user chưa có roadmap active, When mở `/roadmap`, Then FE hiển thị màn Welcome/Onboarding.
- Given user chọn `Có, tôi biết trình độ`, When tiếp tục, Then FE hiển thị lựa chọn JLPT N5-N1.
- Given user chọn `Tôi hoàn toàn mới`, When tiếp tục, Then FE bỏ qua placement test và chuyển đến màn cài đặt mục tiêu với currentLevel beginner/N5.
- Given user chọn `Chưa chắc`, When tiếp tục, Then FE hiển thị placement test khoảng 20 câu.

### Màn 2: Placement test

Mục đích: xác định trình độ phù hợp khi user chưa chắc level.

Nội dung:

- Khoảng 20 câu hỏi kiểm tra nền tảng.
- Sau khi submit, hiển thị kết quả test và cấp AI/hệ thống gợi ý.
- Cho phép user chấp nhận cấp gợi ý hoặc chỉnh lại trước khi sang cài đặt mục tiêu.

Acceptance Criteria:

- Given user hoàn thành placement test, When submit, Then FE gọi `POST /learning-roadmaps/placement/submit`.
- Given API trả `suggestedLevel`, When nhận response, Then FE hiển thị kết quả và dùng level đó làm default cho bước cài đặt mục tiêu.
- Given API lỗi, When submit, Then FE giữ câu trả lời và hiển thị lỗi thử lại.

### Màn 3: Cài đặt mục tiêu

Mục đích: thu thập dữ liệu để AI tạo roadmap.

Nội dung:

- Current level từ nhánh onboarding hoặc placement result.
- Target JLPT/mục tiêu học.
- Thời gian học mỗi ngày.
- Deadline nếu có.
- Kỹ năng ưu tiên: từ vựng, ngữ pháp, kanji, đọc, viết, nghe/nói, luyện thi.
- CTA `Tạo lộ trình cá nhân hóa`.

Acceptance Criteria:

- Given user nhập thiếu goal hoặc dailyMinutes ngoài giới hạn, When submit, Then FE hiển thị lỗi rõ ràng và không gọi API generate.
- Given form hợp lệ, When user bấm tạo lộ trình, Then FE gọi `POST /learning-roadmaps/generate` với payload đúng DTO.
- Given API generate thành công, When nhận response, Then FE chuyển sang Dashboard lộ trình mà không cần reload trang.
- Given API lỗi AI/validation, When submit, Then FE hiển thị message lỗi thân thiện và giữ nguyên input user đã nhập.

### Màn 4: Dashboard lộ trình

Mục đích: là màn chính sau khi có roadmap, bám theo sơ đồ: tuần, bài học hôm nay, % tiến độ và module học hằng ngày.

Nội dung:

- Tổng quan mục tiêu: currentLevel, targetLevel, goal, dailyMinutes, targetDate.
- Tuần hiện tại và mục tiêu tuần.
- Bài học hôm nay lấy từ task chưa hoàn thành đầu tiên hoặc task của ngày hiện tại.
- % tiến độ tổng thể.
- Danh sách module học hằng ngày:
  - Từ vựng: flashcard/SRS.
  - Ngữ pháp: JLPT grammar.
  - Luyện đọc: đoạn văn theo level.
  - Luyện viết: Hiragana/Kanji/writing.
- CTA `Điều chỉnh lộ trình`, `Luyện thi JLPT`, `Lưu trữ lộ trình` nếu cần.

Acceptance Criteria:

- Given user đã có roadmap active, When mở `/roadmap`, Then FE gọi `GET /learning-roadmaps/me` và hiển thị Dashboard lộ trình ngay.
- Given roadmap có weeks/days/tasks, When dashboard render, Then FE hiển thị đúng tuần hiện tại, bài học hôm nay và % tiến độ.
- Given user chọn một module học hằng ngày, When click task, Then FE điều hướng hoặc mở đúng module tương ứng với task type.
- Given roadmap chưa có dữ liệu hợp lệ, When render dashboard, Then FE hiển thị empty/error state thay vì crash.

### Màn 5: Cập nhật tiến độ và review định kỳ

Mục đích: ghi nhận việc học, cập nhật dashboard và sau 7-14 ngày cho AI đánh giá lại.

Nội dung:

- Hoàn thành task từ dashboard hoặc từ module học.
- Cập nhật `completedTaskKeys`.
- Sau 7-14 ngày hoặc khi user bấm kiểm tra tiến độ, gọi review định kỳ.
- Nếu AI đề xuất điều chỉnh, user xác nhận thì regenerate roadmap.

Acceptance Criteria:

- Given user hoàn thành task, When FE gọi `PATCH /learning-roadmaps/:roadmapId/progress`, Then dashboard cập nhật % tiến độ và bài học tiếp theo sau khi API thành công.
- Given update progress thất bại, When API trả lỗi, Then FE rollback trạng thái task và hiển thị lỗi.
- Given đủ điều kiện review 7-14 ngày, When user bấm kiểm tra tiến độ, Then FE gọi `POST /learning-roadmaps/:roadmapId/progress-review`.
- Given review trả `shouldRegenerate = true`, When user xác nhận điều chỉnh, Then FE gọi regenerate và thay roadmap state bằng roadmap mới.
- Given roadmap vào giai đoạn luyện thi, When dashboard render, Then ưu tiên mock test/JLPT exam tasks và hiển thị phân tích kết quả nếu có.


## 9. Chia việc cho 2 fullstack developers độc lập

### Developer 1: Fullstack Onboarding, Placement và Roadmap Generation

Phạm vi sở hữu: màn chào mừng, 3 nhánh onboarding, placement test, cài đặt mục tiêu, tạo roadmap và lấy roadmap active. Developer 1 không cần chờ Developer 2 vì có thể dùng dashboard placeholder sau khi generate thành công.

#### Backend tasks

- [ ] Tạo module `learning_roadmaps` gồm `learning_roadmaps.module.ts`, `learning_roadmaps.controller.ts`, `learning_roadmaps.service.ts`.
- [ ] Tạo schema `LearningRoadmap` trong `schemas/learning_roadmap.schema.ts` với collection `ai_learning_roadmaps`.
- [ ] Tạo `GenerateLearningRoadmapDto` với validation cho `currentLevel`, `targetLevel`, `goal`, `dailyMinutes`, `targetDate`, `focusSkills`.
- [ ] Tạo `SubmitPlacementDto` và `PlacementResult` contract cho placement test.
- [ ] Đăng ký `LearningRoadmapsModule` vào `japanese-learning-backend/src/app.module.ts`.
- [ ] Implement `GET /learning-roadmaps/me` trả roadmap active mới nhất hoặc `null`.
- [ ] Implement `POST /learning-roadmaps/placement/submit` chấm khoảng 20 câu và trả suggestedLevel.
- [ ] Implement `POST /learning-roadmaps/generate` lấy onboarding result + user context, gọi AI, validate JSON output, thêm task keys ổn định và lưu roadmap.
- [ ] Implement AI output validator cho `summary`, `milestones`, `weeks`, `days`, `tasks`.
- [ ] Normalize/reject plan nếu tổng estimatedMinutes theo ngày vượt quá `dailyMinutes + 15`.
- [ ] Tạo mock/sample roadmap object trong test hoặc dev note để FE có thể dùng khi dashboard chưa hoàn thiện.
- [ ] Verify ownership: placement, generate và me chỉ thao tác theo `req.user.sub`.

#### Frontend tasks

- [ ] Thêm route `roadmap: "/roadmap"` trong `japanese-learning-frontend/src/config/routes.js`.
- [ ] Import và đăng ký page `Roadmap` trong `japanese-learning-frontend/src/routes/index.jsx`.
- [ ] Tạo `japanese-learning-frontend/src/services/roadmapService.js` với `getMyRoadmap`, `submitPlacementTest` và `generateRoadmap`.
- [ ] Service unwrap response theo contract `{ success, data }`.
- [ ] Tạo page `src/pages/Roadmap/index.jsx` với flow state: welcome -> level branch -> placement/goal setup -> generating -> dashboard placeholder.
- [ ] Implement initial load flow: loading, error, no roadmap thì vào onboarding, has roadmap thì chuyển dashboard.
- [ ] Implement màn Welcome với 3 lựa chọn: biết trình độ, hoàn toàn mới, chưa chắc.
- [ ] Implement chọn cấp JLPT N5-N1 cho nhánh biết trình độ.
- [ ] Implement placement test khoảng 20 câu và submit lấy suggestedLevel.
- [ ] Implement form cài đặt mục tiêu với validation FE cho required fields và `dailyMinutes`.
- [ ] Implement submit generate, loading state, error state, và chuyển sang dashboard placeholder sau khi thành công.
- [ ] Style onboarding/goal setup theo brand palette hiện tại, không dùng icon trang trí không cần thiết.

#### Acceptance Criteria của Developer 1

- Given user đã đăng nhập và chưa có roadmap active, When mở `/roadmap`, Then FE hiển thị Welcome/Onboarding theo 3 nhánh trong sơ đồ.
- Given user chọn biết trình độ, When tiếp tục, Then FE cho chọn JLPT N5-N1 và dùng làm currentLevel.
- Given user chọn hoàn toàn mới, When tiếp tục, Then FE gán beginner/N5 và bỏ qua placement test.
- Given user chọn chưa chắc, When hoàn thành placement test, Then FE gọi `POST /learning-roadmaps/placement/submit` và dùng suggestedLevel làm default.
- Given user nhập thiếu goal hoặc dailyMinutes ngoài giới hạn, When submit goal setup, Then FE hiển thị lỗi rõ ràng và không gọi API generate.
- Given form hợp lệ, When user bấm `Tạo lộ trình`, Then FE gọi `POST /learning-roadmaps/generate` với payload đúng DTO và hiển thị loading state.
- Given API generate thành công, When nhận response, Then FE chuyển sang Dashboard lộ trình/dashboard placeholder mà không cần reload trang.
- Given AI trả JSON sai shape, When generate, Then BE không lưu roadmap lỗi và FE hiển thị message phù hợp.
- [ ] Verify all AC của Developer 1 are met.
- [ ] Code review.

### Developer 2: Fullstack Dashboard, Daily Modules, Progress Review và Regenerate

Phạm vi sở hữu: dashboard lộ trình, bài học hôm nay, điều hướng module học hằng ngày, cập nhật tiến độ, review định kỳ 7-14 ngày, regenerate/archive và giai đoạn luyện thi JLPT. Developer 2 không cần chờ Developer 1 vì có thể dùng mock roadmap theo contract và giả định endpoints đã có path như mục 4.3.

#### Backend tasks

- [ ] Tạo `UpdateRoadmapProgressDto` với `completedTaskKeys` và `completedWeeks`.
- [ ] Implement `PATCH /learning-roadmaps/:roadmapId/progress` với ownership check theo `_id + userId`.
- [ ] Trong progress update, chỉ chấp nhận task key tồn tại trong roadmap plan.
- [ ] Tự tính `completedWeeks` từ `completedTaskKeys` nếu FE không gửi hoặc gửi sai.
- [ ] Implement `POST /learning-roadmaps/:roadmapId/progress-review` tổng hợp tiến độ, phát hiện weakSkills và trả recommendation.
- [ ] Implement `POST /learning-roadmaps/:roadmapId/regenerate` với ownership check, dùng lại generate flow và archive roadmap cũ hoặc thay active roadmap theo quyết định implementation.
- [ ] Implement `PATCH /learning-roadmaps/:roadmapId/archive` với ownership check.
- [ ] Đảm bảo roadmap của user khác không thể update/regenerate/archive/progress-review.
- [ ] Tạo response lỗi rõ ràng cho roadmap không tồn tại, không thuộc user, task key không hợp lệ.

#### Frontend tasks

- [ ] Bổ sung `updateRoadmapProgress`, `reviewRoadmapProgress`, `regenerateRoadmap`, `archiveRoadmap` vào `roadmapService.js` theo API contract.
- [ ] Implement Dashboard lộ trình: tổng quan mục tiêu, tuần hiện tại, bài học hôm nay, % tiến độ.
- [ ] Implement danh sách module học hằng ngày: từ vựng, ngữ pháp, luyện đọc, luyện viết.
- [ ] Implement điều hướng/mở đúng module khi user chọn task theo `task.type`.
- [ ] Implement complete/uncomplete task với optimistic update, gọi `PATCH /learning-roadmaps/:roadmapId/progress`.
- [ ] Implement rollback UI khi update progress thất bại.
- [ ] Implement tính completion percent, completed task count, completed week count và next task.
- [ ] Implement CTA `Học tiếp` focus bài học hôm nay hoặc task chưa hoàn thành đầu tiên.
- [ ] Implement CTA `Kiểm tra tiến độ` gọi `POST /learning-roadmaps/:roadmapId/progress-review`.
- [ ] Implement UI hiển thị review result: on_track/behind/ahead/needs_adjustment, weakSkills, recommendation.
- [ ] Implement CTA `Điều chỉnh lộ trình` gọi regenerate khi review khuyến nghị và user xác nhận.
- [ ] Implement CTA `Lưu trữ lộ trình` gọi archive và quay về onboarding/goal setup.
- [ ] Implement trạng thái luyện thi JLPT thực chiến: ưu tiên mock test/exam tasks và hiển thị phân tích nếu có.
- [ ] Style dashboard/progress review theo brand palette hiện tại, không dùng per-item check icon trang trí.

#### Acceptance Criteria của Developer 2

- Given user đã có roadmap active, When mở `/roadmap`, Then FE hiển thị Dashboard lộ trình với tuần hiện tại, bài học hôm nay và % tiến độ.
- Given roadmap có task theo type vocabulary/grammar/reading/writing, When user chọn task, Then FE mở hoặc điều hướng đúng module học tương ứng.
- Given roadmap chưa có dữ liệu hợp lệ, When dashboard render, Then FE hiển thị empty/error state thay vì crash.
- Given user bấm hoàn thành một task, When FE gọi `PATCH /learning-roadmaps/:roadmapId/progress`, Then task được đánh dấu completed trên UI sau khi API thành công.
- Given update progress thất bại, When API trả lỗi, Then FE rollback trạng thái task và hiển thị lỗi.
- Given roadmap có progress, When dashboard render, Then FE tính và hiển thị completion percent đúng từ `completedTaskKeys`/total task.
- Given đủ điều kiện review 7-14 ngày, When user bấm kiểm tra tiến độ, Then FE gọi progress-review và hiển thị recommendation.
- Given review trả `shouldRegenerate = true`, When user xác nhận điều chỉnh, Then FE gọi regenerate và thay roadmap state bằng roadmap mới.
- Given roadmap chuyển sang giai đoạn luyện thi JLPT, When dashboard render, Then FE ưu tiên mock test/exam tasks và hiển thị phân tích kết quả nếu có.
- Given user cố update roadmap của user khác, When gọi API progress/progress-review/regenerate/archive, Then BE từ chối request.
- [ ] Verify all AC của Developer 2 are met.
- [ ] Code review.

## 10. Integration checklist sau khi 2 developer merge

- [ ] Kiểm thử flow end-to-end: user mới -> onboarding -> placement/chọn level -> cài đặt mục tiêu -> tạo roadmap -> dashboard -> module học -> hoàn thành task -> xem progress.
- [ ] Kiểm thử review định kỳ: user có dữ liệu 7-14 ngày -> gọi progress-review -> hiển thị recommendation -> regenerate nếu user xác nhận.
- [ ] Kiểm thử regenerate: roadmap cũ không làm hỏng state UI và roadmap mới hiển thị ngay.
- [ ] Kiểm thử archive: active roadmap biến mất và user quay lại onboarding/goal setup.
- [ ] Kiểm thử user không thể truy cập/update roadmap của user khác.
- [ ] Kiểm thử lỗi AI trả JSON sai shape: BE không lưu roadmap lỗi và FE hiển thị message phù hợp.
- [ ] Kiểm thử lỗi network/API ở từng tab: FE không crash và giữ state hợp lý.
- [ ] Kiểm thử responsive UI cho desktop/mobile.
- [ ] Kiểm tra style theo brand palette hiện tại và không dùng icon trang trí không cần thiết.
- [ ] Chạy lint/typecheck/test hiện có cho FE và BE nếu project có script tương ứng.
- [ ] Verify all AC are met.
- [ ] Code review tổng thể.

## 11. Definition of Done

- FE route `/roadmap` hoạt động và render đúng onboarding, goal setup và dashboard lộ trình.
- BE có module `learning_roadmaps` đăng ký trong app module.
- Placement test trả suggestedLevel và tích hợp được vào flow tạo roadmap.
- Roadmap được sinh bằng AI, parse/validate trước khi lưu.
- Mỗi task có `key` ổn định để update progress.
- User chỉ đọc/cập nhật roadmap của chính mình.
- Progress update hoạt động và dashboard tính đúng phần trăm hoàn thành.
- Progress review 7-14 ngày trả recommendation và hỗ trợ điều chỉnh roadmap.
- Regenerate và archive hoạt động không làm mất dữ liệu ngoài ý muốn.
- Empty/loading/error states đầy đủ.
- Không hardcode API URL hoặc màu lệch brand convention.
- Không phát sinh lỗi lint/typecheck/test hiện có.
