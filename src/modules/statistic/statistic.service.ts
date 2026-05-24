import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { InjectModel } from "@nestjs/mongoose";
import type { Cache } from "cache-manager";
import { Model, Types } from "mongoose";
import { UserStreakHistory } from "../user_streak_history/schemas/user_streak_history.schema";
import { UserStudyDay } from "../user_study_day/schemas/user_study_day.schema";
import { ExamResult } from "../exam_results/schemas/exam_results.schema";
import { Profile } from "../profiles/schemas/profiles.schema";
import { JlptKanji } from "../jlpt_kanji/schemas/jlpt_kanji.schema";
import { JlptWord } from "../jlpt_word/schemas/jlpt_word.schema";
import { JlptGrammar } from "../jlpt_grammar/schemas/jlpt_grammar.schema";
import { News } from "../news/schemas/news.schema";
import { Posts } from "../posts/schemas/posts.schema";
import { Exam } from "../exams/schemas/exams.schema";
import { User } from "../users/schemas/user.schema";
import { Comment } from "../comments/schemas/comments.schema";
import { Payment } from "../payments/schemas/payment.schema";

const HANOI_TIMEZONE = "Asia/Ho_Chi_Minh";
const ADMIN_DASHBOARD_DAYS = 30;
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const AI_COST_FRESH_TTL_MS = 60 * 60 * 1000;
const AI_COST_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AI_COST_RETRY_TTL_MS = 15 * 60 * 1000;
const AI_COST_CACHE_PREFIX = "admin_dashboard_ai_cost_v2";
const AI_COST_LAST_GOOD_KEY = `${AI_COST_CACHE_PREFIX}:last_good`;

interface ProfileLean {
  userId: Types.ObjectId;
  name: string;
  image_url?: string;
  createdAt: Date;
  updatedAt: Date;
}

type DateRange = {
  from: Date;
  to: Date;
};

type AiCostStatus = "fresh" | "cached" | "stale" | "unavailable";

type AiCostUsage = {
  totalTokens: number;
  totalCostUsd: number;
  totalCostVnd: number;
  usdToVndRate: number;
};

type AiCostSummary = {
  langfuseUrl: string | null;
  usage30d: AiCostUsage | null;
  status: AiCostStatus;
  fetchedAt: string | null;
  retryAfter?: string;
};

type AiCostSnapshot = {
  usage30d: AiCostUsage;
  fetchedAt: string;
  refreshAfter: string;
};

type AiCostBackoff = {
  retryAfter: string;
};

@Injectable()
export class StatisticService {
  private readonly logger = new Logger(StatisticService.name);
  private aiCostRequest?: Promise<AiCostSummary>;

  constructor(
    @InjectModel(UserStreakHistory.name)
    private streakModel: Model<UserStreakHistory>,

    @InjectModel(UserStudyDay.name)
    private studyDayModel: Model<UserStudyDay>,

    @InjectModel(ExamResult.name)
    private examResultModel: Model<ExamResult>,

    @InjectModel(Profile.name)
    private profileModel: Model<Profile>,

    @InjectModel(JlptKanji.name)
    private jlptKanjiModel: Model<JlptKanji>,

    @InjectModel(JlptWord.name)
    private jlptWordModel: Model<JlptWord>,

    @InjectModel(JlptGrammar.name)
    private jlptGrammarModel: Model<JlptGrammar>,

    @InjectModel(News.name)
    private newsModel: Model<News>,

    @InjectModel(Posts.name)
    private postsModel: Model<Posts>,

    @InjectModel(Exam.name)
    private examModel: Model<Exam>,

    @InjectModel(User.name)
    private userModel: Model<User>,

    @InjectModel(Comment.name)
    private commentModel: Model<Comment>,

    @InjectModel(Payment.name)
    private paymentModel: Model<Payment>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getUserStatistics(userId: string) {
    const objectId = new Types.ObjectId(userId);

    // Lấy thông tin user
    const profile = await this.profileModel
      .findOne({ userId: objectId })
      .lean<ProfileLean>();

    if (!profile) throw new Error("Profile not found");

    // Tổng số ngày học
    const studyDaysCount = await this.studyDayModel.countDocuments({
      user_id: userId, //
    });

    // Chuỗi hiện tại & dài nhất
    const streaks = await this.streakModel
      .find({ user_id: userId }) //
      .sort({ streak_count: -1 });

    const currentStreak = streaks.find((s) => s.is_current)?.streak_count || 0;
    const longestStreak = streaks.length > 0 ? streaks[0].streak_count : 0;

    // Tổng thời gian học tuần này
    const today = new Date();
    const dayOfWeek = today.getDay(); // Chủ nhật = 0
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekRecords = await this.studyDayModel.find({
      user_id: userId,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const totalStudyTimePerWeek = weekRecords.reduce(
      (sum, r) => sum + r.duration_minutes,
      0
    );

    const examResults = await this.examResultModel.find({
      userId: objectId,
      status: "completed",
    });

    const testsCompleted = examResults.length;
    const averageScore =
      testsCompleted > 0
        ? parseFloat(
            (
              examResults.reduce((sum, r) => sum + r.total_score, 0) /
              testsCompleted
            ).toFixed(2)
          )
        : 0;

    // Số lượng từ, kanji học (tạm mock)
    const wordsLearned = 0;
    const kanjiLearned = 0;

    return {
      name: profile.name || "",
      avatar: profile.image_url || "/current-user.jpg",
      joinedDate: profile.createdAt || null,
      stats: {
        studyDays: studyDaysCount,
        currentStreak,
        longestStreak,
        totalStudyTimePerWeek,
        wordsLearned,
        kanjiLearned,
        testsCompleted,
        averageScore,
      },
    };
  }

  async getStatistics() {
    try {
      const [
        profileNumber,
        jlptKanjiNumber,
        jlptWordNumber,
        jlptGrammarNumber,
        newsNumber,
        postsNumber,
        examNumber,
      ] = await Promise.all([
        this.profileModel.countDocuments(),
        this.jlptKanjiModel.countDocuments(),
        this.jlptWordModel.countDocuments(),
        this.jlptGrammarModel.countDocuments(),
        this.newsModel.countDocuments(),
        this.postsModel.countDocuments(),
        this.examModel.countDocuments(),
      ]);

      return {
        profileNumber,
        jlptNumber: jlptKanjiNumber + jlptWordNumber + jlptGrammarNumber,
        newsNumber,
        postsNumber,
        examNumber,
        jlpt: {
          kanji: jlptKanjiNumber,
          word: jlptWordNumber,
          grammar: jlptGrammarNumber,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException("Failed to get statistics");
    }
  }

  async getAdminDashboard() {
    try {
      const range = this.getDashboardRange();
      const todayRange = this.getTodayRange();
      const liveContentFilter = { isDeleted: { $ne: true } };
      const aiCostPromise = this.getAiCostSummary(range);

      const [
        totalUsers,
        newUsers30d,
        activePremiumUsers,
        userRows,
        studyRows,
        examRows,
        wordRows,
        kanjiRows,
        grammarRows,
        words,
        kanji,
        grammar,
        readingPublished,
        readingUnpublished,
        examsPublished,
        examsDraft,
        examsHidden,
        totalPosts,
        overviewExams,
        examUsageRows,
        recentPosts,
        paymentStatusRows,
        paymentProviderRows,
      ] = await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({
          registeredAt: { $gte: range.from, $lt: range.to },
        }),
        this.userModel.countDocuments({
          premium_expired_date: { $gt: new Date() },
        }),
        this.userModel.aggregate([
          {
            $match: {
              registeredAt: { $gte: range.from, $lt: range.to },
            },
          },
          {
            $group: {
              _id: this.dateGroupExpression("registeredAt"),
              users: { $sum: 1 },
            },
          },
        ]),
        this.studyDayModel.aggregate([
          { $match: { date: { $gte: range.from, $lt: range.to } } },
          {
            $group: {
              _id: this.dateGroupExpression("date"),
              learnerIds: { $addToSet: "$user_id" },
              studyMinutes: { $sum: "$duration_minutes" },
            },
          },
          {
            $project: {
              activeLearners: { $size: "$learnerIds" },
              studyMinutes: 1,
            },
          },
        ]),
        this.examResultModel.aggregate([
          {
            $match: {
              status: "completed",
              end_time: { $gte: range.from, $lt: range.to },
            },
          },
          {
            $group: {
              _id: this.dateGroupExpression("end_time"),
              attempts: { $sum: 1 },
              passed: { $sum: { $cond: ["$passed", 1, 0] } },
              averageScore: { $avg: "$total_score" },
            },
          },
        ]),
        this.jlptWordModel.aggregate(this.getCoveragePipeline(liveContentFilter)),
        this.jlptKanjiModel.aggregate(this.getCoveragePipeline(liveContentFilter)),
        this.jlptGrammarModel.aggregate(this.getCoveragePipeline(liveContentFilter)),
        this.jlptWordModel.countDocuments(liveContentFilter),
        this.jlptKanjiModel.countDocuments(liveContentFilter),
        this.jlptGrammarModel.countDocuments(liveContentFilter),
        this.newsModel.countDocuments({ published: true }),
        this.newsModel.countDocuments({ published: { $ne: true } }),
        this.examModel.countDocuments({ status: "published" }),
        this.examModel.countDocuments({ status: "draft" }),
        this.examModel.countDocuments({ status: "hidden" }),
        this.postsModel.countDocuments(),
        this.examModel
          .find()
          .sort({ updatedAt: -1 })
          .limit(8)
          .lean(),
        this.examResultModel.aggregate([
          {
            $match: {
              status: "completed",
              end_time: { $gte: range.from, $lt: range.to },
            },
          },
          {
            $group: {
              _id: "$examId",
              attempts: { $sum: 1 },
              passed: { $sum: { $cond: ["$passed", 1, 0] } },
              averageScore: { $avg: "$total_score" },
            },
          },
        ]),
        this.postsModel
          .find()
          .sort({ created_at: -1 })
          .limit(8)
          .populate("profile_id", "name")
          .lean(),
        this.paymentModel.aggregate([
          {
            $match: {
              createdAt: { $gte: range.from, $lt: range.to },
              status: { $in: ["pending", "failed"] },
            },
          },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        this.paymentModel.aggregate([
          {
            $match: {
              status: "success",
              paidAt: { $gte: range.from, $lt: range.to },
            },
          },
          {
            $group: {
              _id: "$provider",
              count: { $sum: 1 },
              revenue: { $sum: "$amount" },
            },
          },
        ]),
      ]);

      const userGrowth30d = this.fillDailySeries(range, userRows, (row) => ({
        users: this.toNumber(row.users),
      }));
      const learningActivity30d = this.fillDailySeries(
        range,
        studyRows,
        (row) => ({
          activeLearners: this.toNumber(row.activeLearners),
          studyMinutes: this.toNumber(row.studyMinutes),
        }),
      );
      const examActivity30d = this.fillDailySeries(range, examRows, (row) => ({
        attempts: this.toNumber(row.attempts),
        passed: this.toNumber(row.passed),
        averageScore: this.toNullableNumber(row.averageScore),
      }));
      const examAttempts30d = examActivity30d.reduce(
        (sum, row) => sum + row.attempts,
        0,
      );
      const studyMinutes30d = learningActivity30d.reduce(
        (sum, row) => sum + row.studyMinutes,
        0,
      );
      const activeLearnersToday =
        learningActivity30d.find(
          (row) => row.date === this.getDateKey(todayRange.from),
        )?.activeLearners || 0;
      const examUsage = new Map(
        examUsageRows.map((row) => [String(row._id), row]),
      );
      const recentPostIds = recentPosts.map((post: any) => post._id);
      const commentRows =
        recentPostIds.length > 0
          ? await this.commentModel.aggregate([
              {
                $match: {
                  postId: { $in: recentPostIds },
                  isDeleted: { $ne: true },
                },
              },
              { $group: { _id: "$postId", comments: { $sum: 1 } } },
            ])
          : [];
      const commentCounts = new Map(
        commentRows.map((row) => [String(row._id), this.toNumber(row.comments)]),
      );
      const paymentStatus = new Map(
        paymentStatusRows.map((row) => [String(row._id), this.toNumber(row.count)]),
      );
      const successfulPayments30d = paymentProviderRows.reduce(
        (sum, row) => sum + this.toNumber(row.count),
        0,
      );
      const revenue30d = paymentProviderRows.reduce(
        (sum, row) => sum + this.toNumber(row.revenue),
        0,
      );
      const ai = await aiCostPromise;

      return {
        range: {
          timezone: HANOI_TIMEZONE,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          days: ADMIN_DASHBOARD_DAYS,
        },
        summary: {
          totalUsers,
          newUsers30d,
          activeLearnersToday,
          studyMinutes30d,
          examAttempts30d,
          activePremiumUsers,
        },
        trends: {
          userGrowth30d,
          learningActivity30d,
          examActivity30d,
        },
        content: {
          totals: {
            words,
            kanji,
            grammar,
            readingPublished,
            readingUnpublished,
            examsPublished,
            examsDraft,
            examsHidden,
          },
          jlptCoverage: JLPT_LEVELS.map((level) => ({
            level,
            words: this.getCoverageCount(wordRows, level),
            kanji: this.getCoverageCount(kanjiRows, level),
            grammar: this.getCoverageCount(grammarRows, level),
          })),
        },
        examOverview: overviewExams.map((exam: any) => {
          const usage = examUsage.get(String(exam._id));
          const attempts30d = this.toNumber(usage?.attempts);
          return {
            id: String(exam._id),
            title: exam.title || "",
            level: exam.level || "",
            status: exam.status || "",
            attempts30d,
            passRate30d:
              attempts30d > 0
                ? Number(
                    ((this.toNumber(usage?.passed) / attempts30d) * 100).toFixed(
                      1,
                    ),
                  )
                : null,
            averageScore30d: this.toNullableNumber(usage?.averageScore),
            updatedAt: exam.updatedAt ? new Date(exam.updatedAt).toISOString() : null,
          };
        }),
        community: {
          totalPosts,
          recentPosts: recentPosts.map((post: any) => ({
            id: String(post._id),
            title: post.title || "",
            authorName: post.profile_id?.name || "Người dùng",
            status: this.toNumber(post.status),
            comments: commentCounts.get(String(post._id)) || 0,
            createdAt: post.created_at
              ? new Date(post.created_at).toISOString()
              : null,
          })),
        },
        payments: {
          revenue30d,
          successfulPayments30d,
          failedPayments30d: paymentStatus.get("failed") || 0,
          pendingPayments30d: paymentStatus.get("pending") || 0,
          providers30d: paymentProviderRows.map((row) => ({
            provider: String(row._id || ""),
            count: this.toNumber(row.count),
            revenue: this.toNumber(row.revenue),
          })),
        },
        ai,
      };
    } catch (error) {
      throw new InternalServerErrorException("Failed to get admin dashboard");
    }
  }

  private getCoveragePipeline(filter: Record<string, unknown>) {
    return [
      { $match: filter },
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ];
  }

  private getCoverageCount(rows: any[], level: string) {
    const row = rows.find((item) => item._id === level);
    return this.toNumber(row?.count);
  }

  private dateGroupExpression(field: string) {
    return {
      $dateToString: {
        date: `$${field}`,
        format: "%Y-%m-%d",
        timezone: HANOI_TIMEZONE,
      },
    };
  }

  private getDashboardRange(now = new Date()) {
    const today = this.getTodayRange(now);
    const from = new Date(today.from);
    from.setUTCDate(from.getUTCDate() - (ADMIN_DASHBOARD_DAYS - 1));
    return { from, to: today.to };
  }

  private getTodayRange(now = new Date()) {
    const key = this.getDateKey(now);
    const from = new Date(`${key}T00:00:00+07:00`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from, to };
  }

  private getDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: HANOI_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  private fillDailySeries<T extends Record<string, unknown>>(
    range: { from: Date; to: Date },
    rows: any[],
    formatRow: (row: any) => T,
  ) {
    const rowsByDate = new Map(rows.map((row) => [String(row._id), row]));
    const cursor = new Date(range.from);
    const series: Array<{ date: string } & T> = [];

    while (cursor < range.to) {
      const date = this.getDateKey(cursor);
      series.push({
        date,
        ...formatRow(rowsByDate.get(date) || {}),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return series;
  }

  private toNumber(value: unknown) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
  }

  private async getAiCostSummary(range: DateRange): Promise<AiCostSummary> {
    const langfuseUrl = this.getLangfuseDashboardUrl();
    const cacheDateKey = this.getDateKey(range.from);
    const freshKey = `${AI_COST_CACHE_PREFIX}:fresh:${cacheDateKey}`;
    const staleKey = `${AI_COST_CACHE_PREFIX}:last_good:${cacheDateKey}`;
    const backoffKey = `${AI_COST_CACHE_PREFIX}:backoff:${cacheDateKey}`;

    try {
      const freshSnapshot =
        await this.cacheManager.get<AiCostSnapshot>(freshKey);
      if (freshSnapshot) {
        return this.formatAiCostSummary(langfuseUrl, freshSnapshot, "cached");
      }

      const backoff = await this.cacheManager.get<AiCostBackoff>(backoffKey);
      if (backoff && this.isFutureTimestamp(backoff.retryAfter)) {
        return this.getAiCostFallback(langfuseUrl, staleKey, backoff.retryAfter);
      }

      if (!this.aiCostRequest) {
        this.aiCostRequest = this.refreshAiCostSummary(
          range,
          langfuseUrl,
          freshKey,
          staleKey,
          backoffKey,
        );
      }

      try {
        return await this.aiCostRequest;
      } finally {
        this.aiCostRequest = undefined;
      }
    } catch (error) {
      this.logger.warn("Unable to read dashboard AI cost summary");
      return this.unavailableAiCostSummary(langfuseUrl);
    }
  }

  private async refreshAiCostSummary(
    range: DateRange,
    langfuseUrl: string | null,
    freshKey: string,
    staleKey: string,
    backoffKey: string,
  ): Promise<AiCostSummary> {
    const credentials = this.getLangfuseCredentials();
    if (!credentials) {
      return this.unavailableAiCostSummary(langfuseUrl);
    }

    try {
      const snapshot = await this.fetchAiCostSnapshot(range, credentials);
      await Promise.all([
        this.cacheManager.set(freshKey, snapshot, AI_COST_FRESH_TTL_MS),
        this.cacheManager.set(staleKey, snapshot, AI_COST_STALE_TTL_MS),
        this.cacheManager.set(
          AI_COST_LAST_GOOD_KEY,
          snapshot,
          AI_COST_STALE_TTL_MS,
        ),
        this.cacheManager.del(backoffKey),
      ]);
      return this.formatAiCostSummary(langfuseUrl, snapshot, "fresh");
    } catch (error: any) {
      const retryAfter =
        error?.retryAfter instanceof Date
          ? error.retryAfter
          : new Date(Date.now() + AI_COST_RETRY_TTL_MS);

      if (error?.rateLimited) {
        await this.cacheManager.set(
          backoffKey,
          { retryAfter: retryAfter.toISOString() },
          this.getCacheTtlUntil(retryAfter),
        );
      }

      this.logger.warn(
        error?.rateLimited
          ? "Langfuse AI cost metrics are rate limited"
          : "Langfuse AI cost metrics request failed",
      );
      return this.getAiCostFallback(
        langfuseUrl,
        staleKey,
        error?.rateLimited ? retryAfter.toISOString() : undefined,
      );
    }
  }

  private async fetchAiCostSnapshot(
    range: DateRange,
    credentials: { publicKey: string; secretKey: string; baseUrl: string },
  ): Promise<AiCostSnapshot> {
    const query = {
      view: "observations",
      metrics: [
        { measure: "totalTokens", aggregation: "sum" },
        { measure: "totalCost", aggregation: "sum" },
      ],
      filters: [
        {
          column: "type",
          operator: "=",
          value: "GENERATION",
          type: "string",
        },
      ],
      fromTimestamp: range.from.toISOString(),
      toTimestamp: range.to.toISOString(),
      rowLimit: 1,
    };
    const params = new URLSearchParams({ query: JSON.stringify(query) });
    const authorization = Buffer.from(
      `${credentials.publicKey}:${credentials.secretKey}`,
    ).toString("base64");

    let response: Response;
    try {
      response = await fetch(
        `${credentials.baseUrl}/api/public/v2/metrics?${params}`,
        {
          headers: {
            Authorization: `Basic ${authorization}`,
            Accept: "application/json",
          },
        },
      );
    } catch (error) {
      throw new Error("Langfuse AI cost request failed before response");
    }

    if (!response.ok) {
      if (response.status === 429) {
        const rateLimitError: any = new Error(
          "Langfuse AI cost metrics are rate limited",
        );
        rateLimitError.rateLimited = true;
        rateLimitError.retryAfter = this.getRetryAfter(
          response.headers.get("retry-after"),
        );
        throw rateLimitError;
      }

      throw new Error(`Langfuse AI cost request returned ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as
      | { data?: Array<Record<string, unknown>> }
      | null;
    const row = Array.isArray(body?.data) ? body.data[0] || {} : {};
    const fetchedAt = new Date();
    const usdToVndRate = this.getUsdToVndRate();
    const totalCostUsd = this.toNumber(
      row.sum_totalCost ?? row.totalCost_sum,
    );

    return {
      usage30d: {
        totalTokens: this.toNumber(
          row.sum_totalTokens ?? row.totalTokens_sum,
        ),
        totalCostUsd,
        totalCostVnd: Number((totalCostUsd * usdToVndRate).toFixed(2)),
        usdToVndRate,
      },
      fetchedAt: fetchedAt.toISOString(),
      refreshAfter: new Date(
        fetchedAt.getTime() + AI_COST_FRESH_TTL_MS,
      ).toISOString(),
    };
  }

  private async getAiCostFallback(
    langfuseUrl: string | null,
    staleKey: string,
    retryAfter?: string,
  ): Promise<AiCostSummary> {
    const staleSnapshot =
      (await this.cacheManager.get<AiCostSnapshot>(staleKey)) ||
      (await this.cacheManager.get<AiCostSnapshot>(AI_COST_LAST_GOOD_KEY));

    if (!staleSnapshot) {
      return this.unavailableAiCostSummary(langfuseUrl, retryAfter);
    }

    return {
      ...this.formatAiCostSummary(langfuseUrl, staleSnapshot, "stale"),
      ...(retryAfter ? { retryAfter } : {}),
    };
  }

  private formatAiCostSummary(
    langfuseUrl: string | null,
    snapshot: AiCostSnapshot,
    status: AiCostStatus,
  ): AiCostSummary {
    return {
      langfuseUrl,
      usage30d: snapshot.usage30d,
      status,
      fetchedAt: snapshot.fetchedAt,
    };
  }

  private unavailableAiCostSummary(
    langfuseUrl: string | null,
    retryAfter?: string,
  ): AiCostSummary {
    return {
      langfuseUrl,
      usage30d: null,
      status: "unavailable",
      fetchedAt: null,
      ...(retryAfter ? { retryAfter } : {}),
    };
  }

  private getLangfuseCredentials() {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = (process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com")
      .replace(/\/+$/, "");

    return publicKey && secretKey ? { publicKey, secretKey, baseUrl } : null;
  }

  private getLangfuseDashboardUrl() {
    const dashboardUrl = process.env.LANGFUSE_DASHBOARD_URL?.trim();
    return dashboardUrl || null;
  }

  private getUsdToVndRate() {
    return this.toNumber(process.env.AI_COST_USD_TO_VND_RATE);
  }

  private getRetryAfter(retryAfterHeader: string | null) {
    if (!retryAfterHeader) {
      return new Date(Date.now() + AI_COST_RETRY_TTL_MS);
    }

    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds)) {
      return new Date(Date.now() + Math.max(retryAfterSeconds, 1) * 1000);
    }

    const retryAfterDate = new Date(retryAfterHeader);
    return Number.isNaN(retryAfterDate.getTime()) ||
      retryAfterDate.getTime() <= Date.now()
      ? new Date(Date.now() + AI_COST_RETRY_TTL_MS)
      : retryAfterDate;
  }

  private isFutureTimestamp(value: string) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }

  private getCacheTtlUntil(timestamp: Date) {
    return Math.max(timestamp.getTime() - Date.now(), 1000);
  }
}
