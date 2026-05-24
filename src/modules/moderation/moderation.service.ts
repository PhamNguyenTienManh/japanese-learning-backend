import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import Redis from "ioredis";
import { Model, Types } from "mongoose";
import { GoogleGenAIClient } from "../ai/provider/googleGenAIClient";
import { AiLangfuseTracingService } from "../ai/service/ai-langfuse-tracing.service";
import { Comment } from "../comments/schemas/comments.schema";
import { ParComment } from "../par_comment/schemas/par_comment.schema";
import { Posts } from "../posts/schemas/posts.schema";
import { Profile } from "../profiles/schemas/profiles.schema";
import { UpdateModerationSettingDto } from "./dto/update-moderation-setting.dto";
import { findToxicTerms } from "./rules/toxic-terms";
import {
  ModerationCase,
  ModerationCategory,
  ModerationStatus,
  ModerationTargetType,
} from "./schemas/moderation-case.schema";
import { ModerationSetting } from "./schemas/moderation-setting.schema";

type QueueType = "post" | "comment";

type QueueItem = {
  targetType: ModerationTargetType;
  targetId: string;
};

type ModerationTarget = QueueItem & {
  title: string;
  content: string;
  authorId?: Types.ObjectId | null;
  authorName: string;
  parentPostId?: Types.ObjectId | null;
  postContext?: {
    title: string;
    content: string;
  } | null;
};

type AiDecision = {
  id: string;
  targetType: ModerationTargetType;
  isViolation: boolean;
  category?: ModerationCategory | null;
  confidence?: number;
  reason?: string;
};

const DEFAULT_SETTINGS = {
  postBatchSize: 2,
  commentBatchSize: 5,
  batchTimeoutSeconds: 30,
  autoDeleteConfidenceThreshold: 0.8,
};

const QUEUE_PREFIX = "moderation:queue";
const ACTIVE_CASE_STATUSES: ModerationStatus[] = ["pending", "auto_deleted"];

@Injectable()
export class ModerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModerationService.name);
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectModel(ModerationCase.name)
    private readonly moderationCaseModel: Model<ModerationCase>,
    @InjectModel(ModerationSetting.name)
    private readonly moderationSettingModel: Model<ModerationSetting>,
    @InjectModel(Posts.name)
    private readonly postModel: Model<Posts>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<Comment>,
    @InjectModel(ParComment.name)
    private readonly parCommentModel: Model<ParComment>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<Profile>,
    @Inject("REDIS_CLIENT")
    private readonly redisClient: Redis,
    private readonly googleGenAIClient: GoogleGenAIClient,
    private readonly aiLangfuseTracing: AiLangfuseTracingService,
  ) {}

  async onModuleInit() {
    await this.getSettings();
    this.sweepTimer = setInterval(() => {
      void this.flushExpiredQueues();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  async enqueueCreatedContent(targetType: ModerationTargetType, targetId: string) {
    const target = await this.loadTarget({ targetType, targetId });
    if (!target) return;

    const matchedTerms = findToxicTerms(`${target.title}\n${target.content}`);
    if (matchedTerms.length > 0) {
      await this.createViolationCase(target, {
        source: "rulebase",
        category: "abusive_language",
        confidence: null,
        status: "pending",
        reason:
          "Nội dung khớp rulebase từ toxic. Cần admin duyệt vì rulebase có thể sai ngữ cảnh.",
        matchedTerms,
      });
      return;
    }

    const queueType = this.getQueueType(targetType);
    const item: QueueItem = { targetType, targetId };
    const queueKey = this.getQueueKey(queueType);
    const firstAtKey = this.getFirstAtKey(queueType);
    const length = await this.redisClient.rpush(queueKey, JSON.stringify(item));
    if (length === 1) {
      await this.redisClient.set(firstAtKey, String(Date.now()));
    }

    const settings = await this.getSettings();
    const batchSize =
      queueType === "post" ? settings.postBatchSize : settings.commentBatchSize;
    if (length >= batchSize) {
      void this.flushQueue(queueType, batchSize, "batch_size").catch((error) =>
        this.logger.warn(`Moderation flush failed: ${error?.message || error}`),
      );
    }
  }

  async listCases({
    status,
    targetType,
    page = 1,
    limit = 20,
  }: {
    status?: string;
    targetType?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (targetType) filter.targetType = targetType;
    if (status === "handled") {
      filter.status = { $in: ["approved_deleted", "dismissed", "restored"] };
    } else if (status) {
      filter.status = status;
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (safePage - 1) * safeLimit;
    const [items, total] = await Promise.all([
      this.moderationCaseModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.moderationCaseModel.countDocuments(filter),
    ]);

    return {
      data: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPage: Math.ceil(total / safeLimit),
    };
  }

  async deleteCase(caseId: string, adminId?: string) {
    const item = await this.moderationCaseModel.findById(caseId);
    if (!item) return null;

    await this.softDeleteTarget(item.targetType, item.targetId);
    item.status = "approved_deleted";
    item.actionAt = new Date();
    item.actionBy = adminId ? new Types.ObjectId(adminId) : null;
    return item.save();
  }

  async dismissCase(caseId: string, adminId?: string) {
    const item = await this.moderationCaseModel.findById(caseId);
    if (!item) return null;

    item.status = "dismissed";
    item.actionAt = new Date();
    item.actionBy = adminId ? new Types.ObjectId(adminId) : null;
    return item.save();
  }

  async restoreCase(caseId: string, adminId?: string) {
    const item = await this.moderationCaseModel.findById(caseId);
    if (!item) return null;

    await this.restoreTarget(item.targetType, item.targetId);
    item.status = "restored";
    item.actionAt = new Date();
    item.actionBy = adminId ? new Types.ObjectId(adminId) : null;
    return item.save();
  }

  async getSettings() {
    const envDefaults = {
      postBatchSize: this.toBoundedNumber(
        process.env.MODERATION_POST_BATCH_SIZE,
        DEFAULT_SETTINGS.postBatchSize,
        1,
        50,
      ),
      commentBatchSize: this.toBoundedNumber(
        process.env.MODERATION_COMMENT_BATCH_SIZE,
        DEFAULT_SETTINGS.commentBatchSize,
        1,
        100,
      ),
      batchTimeoutSeconds: this.toBoundedNumber(
        process.env.MODERATION_BATCH_TIMEOUT_SECONDS,
        DEFAULT_SETTINGS.batchTimeoutSeconds,
        5,
        300,
      ),
      autoDeleteConfidenceThreshold: this.toBoundedNumber(
        process.env.MODERATION_AUTO_DELETE_CONFIDENCE,
        DEFAULT_SETTINGS.autoDeleteConfidenceThreshold,
        0,
        1,
      ),
    };

    return this.moderationSettingModel
      .findOneAndUpdate(
        { key: "default" },
        { $setOnInsert: { key: "default", ...envDefaults } },
        { new: true, upsert: true },
      )
      .lean();
  }

  async updateSettings(dto: UpdateModerationSettingDto) {
    return this.moderationSettingModel
      .findOneAndUpdate(
        { key: "default" },
        {
          $set: {
            postBatchSize: dto.postBatchSize,
            commentBatchSize: dto.commentBatchSize,
            batchTimeoutSeconds: dto.batchTimeoutSeconds,
            autoDeleteConfidenceThreshold: dto.autoDeleteConfidenceThreshold,
          },
        },
        { new: true, upsert: true },
      )
      .lean();
  }

  private async flushExpiredQueues() {
    await Promise.all([
      this.flushExpiredQueue("post"),
      this.flushExpiredQueue("comment"),
    ]);
  }

  private async flushExpiredQueue(queueType: QueueType) {
    const [settings, firstAtValue, length] = await Promise.all([
      this.getSettings(),
      this.redisClient.get(this.getFirstAtKey(queueType)),
      this.redisClient.llen(this.getQueueKey(queueType)),
    ]);
    if (!firstAtValue || length <= 0) return;

    const firstAt = Number(firstAtValue);
    const timeoutMs = settings.batchTimeoutSeconds * 1000;
    if (Number.isFinite(firstAt) && Date.now() - firstAt >= timeoutMs) {
      await this.flushQueue(queueType, length, "timeout");
    }
  }

  private async flushQueue(
    queueType: QueueType,
    limit: number,
    trigger: "batch_size" | "timeout",
  ) {
    const lockKey = `${QUEUE_PREFIX}:${queueType}:lock`;
    const lock = await this.redisClient.set(lockKey, "1", "PX", 10000, "NX");
    if (lock !== "OK") return;

    try {
      const queueKey = this.getQueueKey(queueType);
      const length = await this.redisClient.llen(queueKey);
      if (length <= 0) return;

      const take = Math.min(Math.max(limit, 1), length);
      const rawItems = await this.redisClient.lrange(queueKey, 0, take - 1);
      await this.redisClient.ltrim(queueKey, take, -1);
      const remaining = await this.redisClient.llen(queueKey);
      if (remaining <= 0) {
        await this.redisClient.del(this.getFirstAtKey(queueType));
      } else {
        await this.redisClient.set(this.getFirstAtKey(queueType), String(Date.now()));
      }

      const queued = rawItems
        .map((item) => this.parseQueueItem(item))
        .filter((item): item is QueueItem => !!item);
      if (queued.length === 0) return;

      await this.processAiBatch(queueType, queued, trigger);
    } finally {
      await this.redisClient.del(lockKey);
    }
  }

  private async processAiBatch(
    queueType: QueueType,
    queued: QueueItem[],
    trigger: "batch_size" | "timeout",
  ) {
    const settings = await this.getSettings();
    const targets = (
      await Promise.all(queued.map((item) => this.loadTarget(item)))
    ).filter((item): item is ModerationTarget => !!item);
    if (targets.length === 0) return;

    const prompt = this.buildModerationPrompt(targets);
    const model = this.googleGenAIClient.getModel();

    try {
      const decisions = await this.aiLangfuseTracing.runModerationObservation(
        {
          batchType: queueType,
          trigger,
          itemCount: targets.length,
          threshold: settings.autoDeleteConfidenceThreshold,
          input: targets.map((target) => ({
            id: target.targetId,
            targetType: target.targetType,
            title: target.title,
            content: target.content,
            ...(target.postContext ? { postContext: target.postContext } : {}),
          })),
        },
        async () => {
          const response = await model.invoke([{ role: "user", content: prompt }]);
          return this.parseAiDecisions(this.extractModelText(response));
        },
        (decisions) => decisions,
      );

      const byId = new Map(targets.map((target) => [target.targetId, target]));
      for (const decision of decisions) {
        if (!decision.isViolation) continue;
        const target = byId.get(decision.id);
        if (!target) continue;

        const confidence = this.clampConfidence(decision.confidence);
        const shouldDelete =
          confidence > settings.autoDeleteConfidenceThreshold;
        if (shouldDelete) {
          await this.softDeleteTarget(target.targetType, new Types.ObjectId(target.targetId));
        }

        await this.createViolationCase(target, {
          source: "ai",
          category: decision.category || null,
          confidence,
          status: shouldDelete ? "auto_deleted" : "pending",
          reason: decision.reason || "AI phát hiện nội dung có khả năng vi phạm.",
          matchedTerms: [],
          aiRawOutput: decision as unknown as Record<string, unknown>,
        });
      }
    } catch (error: any) {
      this.logger.warn(`AI moderation batch failed: ${error?.message || error}`);
    }
  }

  private async createViolationCase(
    target: ModerationTarget,
    input: {
      source: "rulebase" | "ai";
      category?: ModerationCategory | null;
      confidence?: number | null;
      status: ModerationStatus;
      reason: string;
      matchedTerms: string[];
      aiRawOutput?: Record<string, unknown> | null;
    },
  ) {
    const existing = await this.moderationCaseModel.findOne({
      targetType: target.targetType,
      targetId: new Types.ObjectId(target.targetId),
      status: { $in: ACTIVE_CASE_STATUSES },
    });
    if (existing) return existing;

    return this.moderationCaseModel.create({
      targetType: target.targetType,
      targetId: new Types.ObjectId(target.targetId),
      parentPostId: target.parentPostId || null,
      authorId: target.authorId || null,
      authorName: target.authorName,
      title: target.title,
      contentSnapshot: target.content,
      source: input.source,
      category: input.category || null,
      confidence: input.confidence ?? null,
      status: input.status,
      reason: input.reason,
      matchedTerms: input.matchedTerms,
      aiRawOutput: input.aiRawOutput || null,
      actionAt: input.status === "auto_deleted" ? new Date() : null,
    });
  }

  private async loadTarget(item: QueueItem): Promise<ModerationTarget | null> {
    if (!Types.ObjectId.isValid(item.targetId)) return null;
    const targetObjectId = new Types.ObjectId(item.targetId);

    if (item.targetType === "post") {
      const post = await this.postModel
        .findById(targetObjectId)
        .populate("profile_id", "name userId")
        .lean<any>();
      if (!post) return null;

      return {
        targetType: "post",
        targetId: String(post._id),
        title: post.title || "",
        content: post.content || "",
        authorId: post.profile_id?._id || null,
        authorName: post.profile_id?.name || "",
        parentPostId: post._id,
      };
    }

    if (item.targetType === "comment") {
      const comment = await this.commentModel
        .findById(targetObjectId)
        .populate("profileId", "name userId")
        .lean<any>();
      if (!comment) return null;
      const parentPost = comment.postId
        ? await this.postModel
            .findById(comment.postId)
            .select("title content")
            .lean<any>()
        : null;

      return {
        targetType: "comment",
        targetId: String(comment._id),
        title: "",
        content: comment.content || "",
        authorId: comment.profileId?._id || null,
        authorName: comment.profileId?.name || "",
        parentPostId: comment.postId || null,
        postContext: parentPost
          ? {
              title: parentPost.title || "",
              content: this.truncateForPrompt(parentPost.content || "", 1200),
            }
          : null,
      };
    }

    const reply = await this.parCommentModel.findById(targetObjectId).lean<any>();
    if (!reply) return null;
    const parentComment = await this.commentModel.findById(reply.commentId).lean<any>();

    return {
      targetType: "reply_comment",
      targetId: String(reply._id),
      title: "",
      content: reply.content || "",
      authorId: reply.userId || null,
      authorName: "",
      parentPostId: parentComment?.postId || null,
    };
  }

  private async softDeleteTarget(
    targetType: ModerationTargetType,
    targetId: Types.ObjectId,
  ) {
    if (targetType === "post") {
      await this.postModel.findByIdAndUpdate(targetId, { $set: { status: 0 } });
      return;
    }

    if (targetType === "comment") {
      await this.commentModel.findByIdAndUpdate(targetId, {
        $set: { isDeleted: true, status: 0 },
      });
      return;
    }

    await this.parCommentModel.findByIdAndUpdate(targetId, {
      $set: { isDeleted: true, status: 0 },
    });
  }

  private async restoreTarget(
    targetType: ModerationTargetType,
    targetId: Types.ObjectId,
  ) {
    if (targetType === "post") {
      await this.postModel.findByIdAndUpdate(targetId, { $set: { status: 1 } });
      return;
    }

    if (targetType === "comment") {
      await this.commentModel.findByIdAndUpdate(targetId, {
        $set: { isDeleted: false, status: 1 },
      });
      return;
    }

    await this.parCommentModel.findByIdAndUpdate(targetId, {
      $set: { isDeleted: false, status: 1 },
    });
  }

  private buildModerationPrompt(targets: ModerationTarget[]) {
    const payload = targets.map((target) => ({
      id: target.targetId,
      targetType: target.targetType,
      title: target.title,
      content: target.content,
      ...(target.postContext ? { postContext: target.postContext } : {}),
    }));

    return `
Bạn là hệ thống kiểm duyệt cộng đồng học tiếng Nhật JAVI.
Hãy phân loại từng nội dung theo 6 nhóm vi phạm:
1. spam_advertising: spam/quảng cáo/link ngoài không liên quan/lặp nội dung.
2. abusive_language: thô tục, xúc phạm, kỳ thị, tấn công cá nhân.
3. off_topic: không liên quan học tiếng Nhật, gây nhiễu cộng đồng.
4. language_misinformation: giải thích sai ngữ pháp/dịch sai có thể gây hại cho người học.
5. nsfw: nội dung nhạy cảm hoặc không phù hợp.
6. manipulation: thao túng vote, tài khoản ảo, giả mạo giáo viên/admin.

Quan trọng: phân biệt ví dụ học tập hoặc giải thích từ lóng/từ nhạy cảm trong tiếng Nhật với việc dùng từ đó để xúc phạm người khác. Ví dụ học tập hợp lệ thì không đánh dấu vi phạm.
Với targetType="comment", nếu có postContext thì dùng tiêu đề/nội dung bài viết cha để đánh giá comment có off-topic hay không. Với reply_comment không cần postContext.

Chỉ trả JSON hợp lệ, không markdown, theo schema:
{"results":[{"id":"...","targetType":"post|comment|reply_comment","isViolation":true|false,"category":"spam_advertising|abusive_language|off_topic|language_misinformation|nsfw|manipulation|null","confidence":0.0,"reason":"ngắn gọn bằng tiếng Việt"}]}

Nội dung cần duyệt:
${JSON.stringify(payload)}
`.trim();
  }

  private parseAiDecisions(text: string): AiDecision[] {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { results?: AiDecision[] };
    return Array.isArray(parsed.results) ? parsed.results : [];
  }

  private extractModelText(response: any) {
    const content = response?.content ?? response?.text ?? response;
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          typeof part === "string" ? part : part?.text || part?.content || "",
        )
        .join("");
    }
    return typeof content === "string" ? content : String(content);
  }

  private parseQueueItem(raw: string): QueueItem | null {
    try {
      const item = JSON.parse(raw) as QueueItem;
      if (!item.targetType || !item.targetId) return null;
      return item;
    } catch {
      return null;
    }
  }

  private getQueueType(targetType: ModerationTargetType): QueueType {
    return targetType === "post" ? "post" : "comment";
  }

  private getQueueKey(queueType: QueueType) {
    return `${QUEUE_PREFIX}:${queueType}`;
  }

  private getFirstAtKey(queueType: QueueType) {
    return `${QUEUE_PREFIX}:${queueType}:first_at`;
  }

  private toBoundedNumber(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(Math.max(numeric, min), max);
  }

  private clampConfidence(value: unknown) {
    return this.toBoundedNumber(value, 0, 0, 1);
  }

  private truncateForPrompt(value: string, maxLength: number) {
    if (!value || value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  }
}
