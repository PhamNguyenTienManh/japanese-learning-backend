import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  UserActivity,
  UserActivityTargetType,
  UserActivityType,
} from "./schemas/user_activity.schema";

type ActivityObjectId = string | Types.ObjectId | null | undefined;

export type CreateUserActivityInput = {
  userId: ActivityObjectId;
  type: UserActivityType;
  title: string;
  description?: string;
  targetType?: UserActivityTargetType;
  targetId?: ActivityObjectId;
  routeParams?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type LogKanjiLookupInput = {
  kanji: string;
  keyword?: string;
  mean?: string;
  onyomi?: string;
  kunyomi?: string;
  strokeCount?: number | string;
  mobileId?: string | number;
  level?: unknown;
};

@Injectable()
export class UserActivitiesService {
  constructor(
    @InjectModel(UserActivity.name)
    private readonly userActivityModel: Model<UserActivity>,
  ) {}

  async create(input: CreateUserActivityInput): Promise<UserActivity | null> {
    const userObjectId = this.toObjectId(input.userId);
    if (!userObjectId || !input.title?.trim()) return null;

    const targetObjectId = this.toObjectId(input.targetId);

    return this.userActivityModel.create({
      user_id: userObjectId,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim(),
      target_type: input.targetType || UserActivityTargetType.DASHBOARD,
      target_id: targetObjectId,
      route_params: input.routeParams || {},
      metadata: input.metadata || {},
    });
  }

  createSafely(
    input: CreateUserActivityInput,
    failureMessage = "Failed to create user activity:",
  ): void {
    void this.create(input).catch((error) =>
      console.error(failureMessage, error),
    );
  }

  logKanjiLookup(userId: string, input: LogKanjiLookupInput): void {
    const kanji = input.kanji?.trim();
    if (!kanji) return;

    this.createSafely({
      userId,
      type: UserActivityType.DICTIONARY_LOOKED_UP,
      title: `Đã tra kanji: ${kanji}`,
      targetType: UserActivityTargetType.DICTIONARY,
      routeParams: {
        source: "kanji_lookup",
        kanji,
      },
      metadata: {
        entryType: "kanji_lookup",
        kanji,
        keyword: input.keyword,
        mean: input.mean,
        onyomi: input.onyomi,
        kunyomi: input.kunyomi,
        strokeCount: input.strokeCount,
        mobileId: input.mobileId,
        level: input.level,
      },
    }, "Failed to create kanji lookup activity:");
  }

  async getRecent(userId: string, limit = 10) {
    return this.getByUser(userId, limit);
  }

  async getByUser(userId: string, limit = 10) {
    const userObjectId = this.toObjectId(userId);
    if (!userObjectId) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const activities = await this.userActivityModel
      .find({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return activities.map((activity: any) => this.toResponse(activity));
  }

  private toResponse(activity: any) {
    return {
      id: String(activity._id),
      type: activity.type,
      title: activity.title,
      description: activity.description || "",
      target_type: activity.target_type,
      target_id: activity.target_id ? String(activity.target_id) : null,
      route_params: activity.route_params || {},
      metadata: activity.metadata || {},
      href: this.buildHref(activity),
      createdAt: activity.createdAt
        ? new Date(activity.createdAt).toISOString()
        : null,
      updatedAt: activity.updatedAt
        ? new Date(activity.updatedAt).toISOString()
        : null,
    };
  }

  private buildHref(activity: any) {
    const targetId = activity.target_id ? String(activity.target_id) : "";
    const routeParams = activity.route_params || {};

    switch (activity.target_type) {
      case UserActivityTargetType.POST:
        return targetId ? `/community/${targetId}` : "/community";

      case UserActivityTargetType.NOTEBOOK:
        return targetId
          ? `/dictionary/notebook/${targetId}`
          : "/dictionary/notebook";

      case UserActivityTargetType.NOTEBOOK_FLASHCARDS:
        return targetId
          ? `/dictionary/notebook/${targetId}/flashcards`
          : "/dictionary/notebook";

      case UserActivityTargetType.EXAM_RESULT: {
        const level = this.toRouteSegment(routeParams.level);
        const testId = this.toRouteSegment(routeParams.testId);
        return level && testId
          ? `/practice/${level}/results/detail/${testId}`
          : "/practice";
      }

      case UserActivityTargetType.DICTIONARY:
        if (activity.metadata?.entryType === "kanji_lookup") {
          const kanji = this.toRouteSegment(
            activity.metadata?.kanji || routeParams.kanji,
          );
          return kanji ? `/kanji?kanji=${encodeURIComponent(kanji)}` : "/kanji";
        }
        return "/dictionary";

      case UserActivityTargetType.JLPT:
        return "/jlpt";

      case UserActivityTargetType.CHAT:
        return "/chat-ai";

      case UserActivityTargetType.DASHBOARD:
      default:
        return "/dashboard";
    }
  }

  private toRouteSegment(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  private toObjectId(value: ActivityObjectId) {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value;
    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
  }
}
