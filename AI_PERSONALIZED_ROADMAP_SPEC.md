# Spec: AI Personalized Learning Roadmap

## 1. Mục tiêu

Xây dựng chức năng tạo lộ trình học tiếng Nhật cá nhân hoá cho từng user bằng AI. User có thể khai báo mục tiêu học, trình độ hiện tại, thời gian học mỗi ngày, deadline và kỹ năng muốn ưu tiên; hệ thống dùng dữ liệu hồ sơ + hoạt động học hiện có để đề xuất roadmap theo tuần/ngày, lưu lại để user theo dõi và cập nhật tiến độ.

## 2. Phạm vi

### In scope

- Thêm trang FE mới cho lộ trình cá nhân hoá.
- Tạo module BE mới để lưu, lấy, cập nhật và regenerate roadmap theo user đăng nhập.
- Tích hợp AI để sinh roadmap có cấu trúc JSON ổn định.
- Roadmap có 3 tab chính: `Tổng quan`, `Kế hoạch học`, `Tiến độ`.
- User chỉ thao tác được roadmap của chính mình thông qua JWT hiện tại.

### Out of scope

- Không tự động đăng ký lịch học vào calendar bên ngoài.
- Không làm recommendation realtime sau mỗi câu hỏi luyện tập.
- Không thay đổi logic bài thi, từ vựng, notebook, streak hiện tại nếu không cần thiết cho context AI.

## 3. Convention hiện tại cần tuân thủ

### Frontend

- Project FE nằm trong `japanese-learning-frontend` và dùng React JSX.
- Route được khai báo trong `src/config/routes.js` và map page trong `src/routes/index.jsx`.
- Page đặt theo convention `src/pages/<Feature>/index.jsx`.
- Service API đặt trong `src/services/<feature>Service.js`.
- API request hiện có dùng `fetch` với `credentials: "include"` ở `aiService.js` hoặc axios wrapper từ `src/apis/configs/httpRequest.js`; với feature này ưu tiên dùng axios wrapper để đồng nhất service mới, trừ khi cần streaming.
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
- Response nên trả object rõ ràng theo pattern hiện tại, ví dụ `{ success: true, data: ... }` hoặc data trực tiếp nếu service hiện tại đang dùng; trong feature mới thống nhất dùng `{ success, data, message? }`.
- AI integration nên tận dụng `AiModule`/agent/service hiện có nếu phù hợp thay vì tạo provider rời rạc.

## 4. Data model đề xuất

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

## 5. API đề xuất

Base resource: `/learning-roadmaps`.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/learning-roadmaps/me` | Lấy roadmap active mới nhất của user đăng nhập |
| `POST` | `/learning-roadmaps/generate` | Tạo roadmap mới bằng AI từ form input + user context |
| `PATCH` | `/learning-roadmaps/:roadmapId/progress` | Cập nhật task/week đã hoàn thành |
| `POST` | `/learning-roadmaps/:roadmapId/regenerate` | Sinh lại roadmap dựa trên input/context mới |
| `PATCH` | `/learning-roadmaps/:roadmapId/archive` | Archive roadmap hiện tại |

### DTO chính

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

`UpdateRoadmapProgressDto`:

```ts
{
  completedTaskKeys?: string[];
  completedWeeks?: number[];
}
```

### Rule bảo mật và dữ liệu

- Mọi endpoint lấy `userId` từ `req.user.sub`, không nhận `userId` từ body/query.
- Với `:roadmapId`, service phải kiểm tra roadmap thuộc user hiện tại trước khi update/read.
- Validate `dailyMinutes` trong khoảng hợp lý, đề xuất `15 <= dailyMinutes <= 240`.
- Validate `goal` không rỗng và giới hạn độ dài để tránh prompt quá lớn.
- Không lưu raw prompt chứa dữ liệu nhạy cảm nếu không cần thiết.

## 6. AI prompt/output contract

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

## 7. UI/UX đề xuất

Route mới: `/roadmap`.

FE files đề xuất:

- `src/pages/Roadmap/index.jsx`
- `src/pages/Roadmap/index.scss` hoặc style file theo pattern page hiện tại
- `src/services/roadmapService.js`
- Update `src/config/routes.js`
- Update `src/routes/index.jsx`

### Tab 1: Tổng quan

Mục đích: cho user thấy mục tiêu, lý do AI đề xuất lộ trình và CTA tạo/cập nhật roadmap.

Nội dung:

- Empty state nếu chưa có roadmap: form tạo roadmap.
- Form fields: trình độ hiện tại, mục tiêu JLPT, mục tiêu học tự do, thời gian học mỗi ngày, deadline, kỹ năng ưu tiên.
- Nếu đã có roadmap: hiển thị summary, target level, daily minutes, target date, milestones.
- CTA: `Tạo lộ trình`, `Tạo lại lộ trình`, `Lưu thay đổi` nếu có chỉnh input.

Acceptance Criteria:

- Given user đã đăng nhập và chưa có roadmap active, When mở `/roadmap`, Then tab `Tổng quan` hiển thị form tạo roadmap.
- Given user nhập thiếu goal hoặc dailyMinutes ngoài giới hạn, When submit, Then FE hiển thị lỗi rõ ràng và không gọi API generate.
- Given form hợp lệ, When user bấm `Tạo lộ trình`, Then FE gọi `POST /learning-roadmaps/generate` với payload đúng DTO và hiển thị loading state.
- Given API generate thành công, When nhận response, Then FE render summary và milestones trong tab `Tổng quan` mà không cần reload trang.
- Given user đã có roadmap active, When mở `/roadmap`, Then FE gọi `GET /learning-roadmaps/me` và hiển thị roadmap mới nhất.
- Given API lỗi daily AI limit hoặc lỗi generate, When submit, Then FE hiển thị message lỗi thân thiện và giữ nguyên input user đã nhập.

### Tab 2: Kế hoạch học

Mục đích: hiển thị roadmap chi tiết theo tuần/ngày/task để user biết hôm nay cần học gì.

Nội dung:

- Danh sách tuần theo thứ tự tăng dần.
- Mỗi tuần có title, goal, danh sách ngày.
- Mỗi ngày có các task: loại kỹ năng, title, mô tả, estimatedMinutes.
- Cho phép expand/collapse tuần hoặc ngày nếu UI cần gọn.

Acceptance Criteria:

- Given roadmap có weeks/days/tasks, When user chọn tab `Kế hoạch học`, Then FE hiển thị đầy đủ week title, day title và task detail theo đúng thứ tự từ API.
- Given một task có `estimatedMinutes`, When render task, Then tổng thời lượng trong ngày không vượt quá đáng kể dailyMinutes đã chọn; nếu AI trả vượt, BE phải normalize hoặc reject trước khi lưu.
- Given roadmap chưa có dữ liệu hợp lệ, When user chọn tab này, Then FE hiển thị empty/error state thay vì crash.
- Given user bấm hoàn thành một task, When FE gọi `PATCH /learning-roadmaps/:roadmapId/progress`, Then task được đánh dấu completed trên UI sau khi API thành công.
- Given update progress thất bại, When API trả lỗi, Then FE rollback trạng thái task và hiển thị lỗi.

### Tab 3: Tiến độ

Mục đích: giúp user theo dõi tiến độ roadmap và xem bước tiếp theo.

Nội dung:

- Phần trăm hoàn thành tổng thể.
- Số tuần đã hoàn thành / tổng số tuần.
- Task đã hoàn thành / tổng task.
- Gợi ý `Việc nên học tiếp theo` dựa trên task chưa hoàn thành đầu tiên.
- CTA quay lại tab `Kế hoạch học`.

Acceptance Criteria:

- Given roadmap có progress, When user chọn tab `Tiến độ`, Then FE tính và hiển thị completion percent đúng từ `completedTaskKeys`/total task.
- Given user hoàn thành tất cả task của một tuần, When progress được cập nhật, Then tuần đó được tính là completed.
- Given còn task chưa hoàn thành, When hiển thị `Việc nên học tiếp theo`, Then chọn task chưa completed đầu tiên theo thứ tự week/day/task.
- Given toàn bộ roadmap hoàn thành, When mở tab `Tiến độ`, Then hiển thị trạng thái hoàn thành và CTA tạo roadmap mới hoặc tạo lại roadmap.

## 8. 3 Subtasks theo /task-helper

### Subtask 1: Frontend - Xây dựng trang Roadmap và service API

Tasks:

- [ ] Thêm route `roadmap: "/roadmap"` trong `japanese-learning-frontend/src/config/routes.js`.
- [ ] Import và đăng ký page `Roadmap` trong `japanese-learning-frontend/src/routes/index.jsx`.
- [ ] Tạo `japanese-learning-frontend/src/services/roadmapService.js` với các hàm `getMyRoadmap`, `generateRoadmap`, `updateRoadmapProgress`, `regenerateRoadmap`, `archiveRoadmap`.
- [ ] Tạo page `japanese-learning-frontend/src/pages/Roadmap/index.jsx` gồm 3 tab `Tổng quan`, `Kế hoạch học`, `Tiến độ`.
- [ ] Implement form tạo roadmap với validation FE cho required fields và `dailyMinutes`.
- [ ] Implement UI render roadmap summary, milestones, weeks/days/tasks và progress.
- [ ] Implement loading/error/empty states cho cả 3 tab.
- [ ] Verify tất cả AC của 3 tab ở FE.
- [ ] Code review.

### Subtask 2: Backend/AI - Tạo module Learning Roadmaps và AI generation

Tasks:

- [ ] Tạo module `learning_roadmaps` gồm `learning_roadmaps.module.ts`, `learning_roadmaps.controller.ts`, `learning_roadmaps.service.ts`.
- [ ] Tạo schema `LearningRoadmap` trong `schemas/learning_roadmap.schema.ts` với collection `ai_learning_roadmaps`.
- [ ] Tạo DTO `GenerateLearningRoadmapDto` và `UpdateRoadmapProgressDto` trong `dto/learning-roadmap.dto.ts`.
- [ ] Đăng ký `LearningRoadmapsModule` vào `japanese-learning-backend/src/app.module.ts`.
- [ ] Implement endpoint `GET /learning-roadmaps/me` chỉ lấy roadmap active của user hiện tại.
- [ ] Implement endpoint `POST /learning-roadmaps/generate` lấy user context, gọi AI, validate JSON output và lưu roadmap.
- [ ] Implement endpoint `PATCH /learning-roadmaps/:roadmapId/progress` với ownership check.
- [ ] Implement endpoint `POST /learning-roadmaps/:roadmapId/regenerate` với ownership check và archive/update roadmap cũ theo quyết định implementation.
- [ ] Implement endpoint `PATCH /learning-roadmaps/:roadmapId/archive` với ownership check.
- [ ] Reuse `AiModule` hoặc service AI hiện có để tránh duplicate cấu hình AI.
- [ ] Verify tất cả AC liên quan API, ownership, validation và AI output contract.
- [ ] Code review.

### Subtask 3: Tích hợp, kiểm thử và hoàn thiện trải nghiệm

Tasks:

- [ ] Kiểm thử flow end-to-end: user chưa có roadmap -> tạo roadmap -> xem 3 tab -> hoàn thành task -> xem progress.
- [ ] Kiểm thử user không thể truy cập/update roadmap của user khác.
- [ ] Kiểm thử lỗi AI trả JSON sai shape: BE không lưu roadmap lỗi và FE hiển thị message phù hợp.
- [ ] Kiểm thử lỗi network/API ở từng tab: FE không crash và giữ state hợp lý.
- [ ] Kiểm thử responsive UI cho desktop/mobile.
- [ ] Kiểm tra style theo brand palette hiện tại và không dùng icon trang trí không cần thiết.
- [ ] Chạy lint/typecheck/test hiện có cho FE và BE nếu project có script tương ứng.
- [ ] Verify all AC are met.
- [ ] Code review.

## 9. Definition of Done

- FE route `/roadmap` hoạt động và render đúng 3 tab.
- BE có module `learning_roadmaps` đăng ký trong app module.
- Roadmap được sinh bằng AI, parse/validate trước khi lưu.
- User chỉ đọc/cập nhật roadmap của chính mình.
- Progress update hoạt động và tab `Tiến độ` tính đúng phần trăm hoàn thành.
- Empty/loading/error states đầy đủ.
- Không hardcode API URL hoặc màu lệch brand convention.
- Không phát sinh lỗi lint/typecheck/test hiện có.
