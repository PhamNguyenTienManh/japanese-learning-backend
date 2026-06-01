import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ExamResult, ExamStatus } from "./schemas/exam_results.schema";
import { ExamPart } from "../exams_part/schema/exams_part.schema";
import {
  ExamUserAnswer,
  UserAnswer,
} from "../exam_user_answers/schemas/exam_user_answers.schema";
import { Exam } from "../exams/schemas/exams.schema";
import { ExamResultDetail } from "../exam_results_detail/schemas/exam_results_detail.schema";
import {
  ExamQuestion,
  QuestionContent,
} from "../exam_question/schemas/exam_question.schema";
import { ExamQuestionModule } from "../exam_question/exam_question.module";
import { UserActivitiesService } from "../user_activities/user_activities.service";
import {
  UserActivityTargetType,
  UserActivityType,
} from "../user_activities/schemas/user_activity.schema";
import { Profile } from "../profiles/schemas/profiles.schema";

// ===== INTERFACES =====
interface QuestionComparison {
  questionId: string;
  questionNumber: string;
  questionTitle: string;
  questionKind?: string;
  questionText: string;
  answers: string[];
  userAnswer: number;
  correctAnswer: number;
  userAnswerText?: string;
  correctAnswerText?: string;
  isCorrect: boolean;
  explain?: string;
  explainAll?: string;
  image?: string;
  score?: number;
  level?: number;
  generalInfo?: {
    audio?: string;
    image?: string;
    txt_read?: string;
    audios?: { audio_time: number | null }[];
  };
}

interface PartComparison {
  partId: string;
  partTitle: string;
  score: number;
  maxScore: number;
  questions: QuestionComparison[];
}

export interface ExamComparisonResult {
  examResultId: string;
  totalScore: number;
  maxScore: number;
  passed: boolean;
  duration: number;
  parts: PartComparison[];
}

interface AdminAttemptStatsQuery {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
}

@Injectable()
export class ExamResultsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(ExamResult.name) private examResultModel: Model<ExamResult>,
    @InjectModel(ExamPart.name) private examPartModel: Model<ExamPart>,
    @InjectModel(ExamUserAnswer.name)
    private examUserAnswerModel: Model<ExamUserAnswer>,
    @InjectModel(ExamResultDetail.name)
    private examResultDetailModel: Model<ExamResultDetail>,
    @InjectModel(ExamQuestion.name)
    private examQuestionModel: Model<ExamQuestionModule>,
    @InjectModel(Profile.name) private profileModel: Model<Profile>,
    private readonly userActivitiesService: UserActivitiesService,
  ) {}

  async startExam(examId: string, userId: string): Promise<ExamResult> {
    // 1. Kiểm tra exam có tồn tại hay không
    const exam = await this.examModel.findById(examId).exec();
    if (!exam) {
      throw new NotFoundException(`Exam with id ${examId} does not exist`);
    }

    // 2. Tạo examResult
    const examResult = new this.examResultModel({
      examId: new Types.ObjectId(examId),
      userId: new Types.ObjectId(userId),
      start_time: new Date(),
      end_time: new Date(), // tạm set
      duration: 0,
      total_score: 0,
      passed: false,
      details: [],
      status: ExamStatus.IN_PROGRESS,
    });

    const savedResult = await examResult.save();

    // 3. Khởi tạo UserAnswer cho từng phần của exam
    const parts = await this.examPartModel
      .find({ examId: new Types.ObjectId(examId) })
      .exec();
    for (const part of parts) {
      const userAnswer = new this.examUserAnswerModel({
        examResultId: savedResult._id,
        partId: part._id,
        userId: new Types.ObjectId(userId),
        answers: [],
        score: 0,
      });
      await userAnswer.save();
    }

    return savedResult;
  }

  // --- Resume bài thi ---
  async resumeExam(examResultId: string, userId: string) {
    const examResultOid = new Types.ObjectId(examResultId);
    const userOid = new Types.ObjectId(userId);

    const examResult = await this.examResultModel.findOne({
      _id: examResultOid,
      userId: userOid,
    });
    if (!examResult) throw new NotFoundException("ExamResult not found");

    const answers = await this.examUserAnswerModel
      .find({ examResultId: examResultOid, userId: userOid })
      .lean();

    return {
      examResultId,
      examId: examResult.examId,
      start_time: examResult.start_time,
      elapsed: examResult.saved_elapsed ?? 0, // thời gian đã làm khi user lưu
      answers,
    };
  }

  // --- Lưu tiến trình bài thi ---
  async saveProgress(examResultId: string, userId: string, elapsed: number) {
    const examResult = await this.examResultModel.findOne({
      _id: new Types.ObjectId(examResultId),
      userId: new Types.ObjectId(userId),
    });
    if (!examResult) throw new NotFoundException("ExamResult not found");
    if (examResult.status === ExamStatus.COMPLETED) {
      throw new Error("Cannot save a completed exam");
    }

    examResult.status = ExamStatus.SAVING;
    examResult.saved_elapsed = elapsed;
    await examResult.save();

    return { examResultId, elapsed };
  }

  // Kiểm tra trạng thái bài làm của user
  async checkExamStatus(examId: string, userId: string) {
    const baseFilter = {
      examId: new Types.ObjectId(examId),
      userId: new Types.ObjectId(userId),
    };

    const latest = await this.examResultModel
      .findOne(baseFilter)
      .sort({ createdAt: -1 }); // lấy bài mới nhất

    const latestCompleted = await this.examResultModel
      .findOne({
        ...baseFilter,
        status: ExamStatus.COMPLETED,
      })
      .sort({ end_time: -1, createdAt: -1 });

    const completedMeta = {
      hasCompletedResult: Boolean(latestCompleted),
      completedExamResultId: latestCompleted?._id,
    };

    if (!latest) {
      return { status: "not_started", ...completedMeta };
    }

    if (latest.status === ExamStatus.COMPLETED) {
      return { status: "completed", examResultId: latest._id, ...completedMeta };
    }

    if (latest.status === ExamStatus.SAVING) {
      return { status: "saving", examResultId: latest._id, ...completedMeta };
    }

    // IN_PROGRESS (chưa lưu thủ công) → xem như chưa làm
    return { status: "not_started", ...completedMeta };
  }

  async getAdminExamAttemptStatistics(
    examId: string,
    query: AdminAttemptStatsQuery = {},
  ) {
    if (!Types.ObjectId.isValid(examId)) {
      throw new NotFoundException(`Exam with id ${examId} does not exist`);
    }

    const examObjectId = new Types.ObjectId(examId);
    const exam = await this.examModel.findById(examObjectId).lean().exec();

    if (!exam) {
      throw new NotFoundException(`Exam with id ${examId} does not exist`);
    }

    const status = String(query.status || "all").toLowerCase();
    const allowedStatuses = new Set([
      "all",
      ExamStatus.IN_PROGRESS,
      ExamStatus.SAVING,
      ExamStatus.COMPLETED,
    ]);
    const normalizedStatus = allowedStatuses.has(status) ? status : "all";
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const search = String(query.q || "").trim().toLowerCase();

    const allAttempts = await this.examResultModel
      .find({ examId: examObjectId })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        model: "User",
        select: "email",
      })
      .lean()
      .exec();

    const userIds = Array.from(
      new Set(
        allAttempts
          .map((attempt: any) => attempt.userId?._id?.toString?.() || attempt.userId?.toString?.())
          .filter(Boolean),
      ),
    );

    const profiles = userIds.length
      ? await this.profileModel
          .find({ userId: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
          .select("userId name")
          .lean()
          .exec()
      : [];

    const profileByUserId = new Map(
      profiles.map((profile: any) => [profile.userId?.toString(), profile]),
    );
    const maxScore = await this.getExamMaxScore(
      examObjectId,
      Number((exam as any)?.score) || 0,
    );

    const rows = allAttempts.map((attempt: any) => {
      const userIdValue =
        attempt.userId?._id?.toString?.() || attempt.userId?.toString?.() || "";
      const email = attempt.userId?.email || "";
      const profile = profileByUserId.get(userIdValue);
      const fallbackName = email ? email.split("@")[0] : "Chưa có tên";

      return {
        examResultId: attempt._id?.toString(),
        user: {
          id: userIdValue,
          email,
          name: profile?.name || fallbackName,
        },
        status: attempt.status,
        totalScore: Number(attempt.total_score) || 0,
        maxScore,
        passed: Boolean(attempt.passed),
        duration: Number(attempt.duration) || 0,
        startTime: attempt.start_time,
        endTime: attempt.end_time,
        createdAt: attempt.createdAt,
      };
    });

    const completedRows = rows.filter((row) => row.status === ExamStatus.COMPLETED);
    const passedRows = completedRows.filter((row) => row.passed);
    const averageScore = completedRows.length
      ? Math.round(
          (completedRows.reduce((sum, row) => sum + row.totalScore, 0) /
            completedRows.length) *
            10,
        ) / 10
      : 0;

    const summary = {
      totalAttempts: rows.length,
      completed: completedRows.length,
      inProgress: rows.filter((row) => row.status === ExamStatus.IN_PROGRESS).length,
      saving: rows.filter((row) => row.status === ExamStatus.SAVING).length,
      passed: passedRows.length,
      failed: completedRows.length - passedRows.length,
      averageScore,
      passRate: completedRows.length
        ? Math.round((passedRows.length / completedRows.length) * 100)
        : 0,
    };

    const filteredRows = rows.filter((row) => {
      const statusMatches =
        normalizedStatus === "all" || row.status === normalizedStatus;
      const searchMatches =
        !search ||
        row.user.email.toLowerCase().includes(search) ||
        row.user.name.toLowerCase().includes(search);

      return statusMatches && searchMatches;
    });

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      exam: {
        _id: (exam as any)._id,
        title: (exam as any).title,
        level: (exam as any).level,
        score: (exam as any).score,
        pass_score: (exam as any).pass_score,
      },
      summary,
      rows: filteredRows.slice(start, start + limit),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getResultDetailByExam(examId: string, userId: string) {
    // --- Lấy ExamResult mới nhất của user cho exam này ---
    const examResult = await this.examResultModel
      .findOne({
        examId: new Types.ObjectId(examId),
        userId: new Types.ObjectId(userId),
        status: ExamStatus.COMPLETED,
      })
      .sort({ end_time: -1, createdAt: -1 }) // Lấy kết quả completed mới nhất
      .populate({
        path: "details",
        model: "ExamResultDetail",
        populate: {
          path: "partId",
          model: "ExamPart",
        },
      })
      .populate({
        path: "examId",
        model: "Exam",
      })
      .exec();

    if (!examResult) throw new Error("Chưa có kết quả thi cho đề này");

    if (examResult.status !== ExamStatus.COMPLETED) {
      throw new Error("Bài thi này chưa được nộp");
    }

    // Map từng phần
    const parts = (examResult.details || []).map((detail: any) => ({
      name: detail.partId?.name || "Unknown Part",
      score: detail.score,
      max_score: detail.partId?.max_score || 0,
    }));

    const totalMaxScore = parts.reduce((sum, p) => sum + (p.max_score || 0), 0);

    // --- Return dữ liệu ---
    return {
      exam: {
        id: (examResult.examId as any)?._id,
        title: (examResult.examId as any)?.title || "Unknown Exam",
        level: (examResult.examId as any)?.level || "N5",
        score: (examResult.examId as any)?.score,
        pass_score: (examResult.examId as any)?.pass_score,
      },
      parts,
      totalScore: examResult.total_score,
      totalMaxScore,
      durationSeconds: examResult.duration,
      passed: examResult.passed,
    };
  }

  async getExamComparison(
    examId: string,
    userId: string
  ): Promise<ExamComparisonResult> {
    const examResult = await this.examResultModel
      .findOne({
        examId: new Types.ObjectId(examId),
        userId: new Types.ObjectId(userId),
        status: ExamStatus.COMPLETED,
      })
      .sort({ end_time: -1 })
      .exec();

    if (!examResult) {
      throw new Error("No completed exam result found for this exam");
    }

    const examResultId = examResult.id.toString();

    const userAnswers = await this.examUserAnswerModel
      .find({
        examResultId: examResult._id,
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!userAnswers || userAnswers.length === 0) {
      throw new Error("No answers found for this exam");
    }

    const exam = await this.examModel.findById(examResult.examId).lean();
    const examMaxScore = Number(exam?.score) || 180;
    const fallbackMaxScore = await this.getExamMaxScore(examResult.examId, examMaxScore);
    const parts: PartComparison[] = [];

    for (const ua of userAnswers) {
      const partIdValue =
        ua.partId instanceof Types.ObjectId
          ? ua.partId
          : new Types.ObjectId(ua.partId);

      const partInfo = await this.examPartModel.findById(partIdValue).exec();

      const examQuestions = (await this.examQuestionModel
        .find({ partId: partIdValue })
        .lean()
        .exec()) as unknown as (ExamQuestion & { _id: Types.ObjectId })[];

      const questions: QuestionComparison[] = [];

      // Loop qua TẤT CẢ câu hỏi
      for (
        let questionIdx = 0;
        questionIdx < examQuestions.length;
        questionIdx++
      ) {
        const examQuestion = examQuestions[questionIdx];
        const questionIdStr = examQuestion._id.toString();
        const content: QuestionContent[] = examQuestion.content || [];

        // Lấy số thứ tự câu hỏi (1, 2, 3...)
        const questionNumber = questionIdx + 1;

        // Loop qua TẤT CẢ subquestion trong content
        for (let contentIdx = 0; contentIdx < content.length; contentIdx++) {
          const questionContent = content[contentIdx];

          // Tìm câu trả lời tương ứng dựa trên subQuestionIndex
          const userAnswerObj = ua.answers.find(
            (a) =>
              a.questionId.toString() === questionIdStr &&
              a.subQuestionIndex === contentIdx
          );

          const comparison: QuestionComparison = {
            questionId: questionIdStr,
            questionNumber: `${questionNumber}.${contentIdx + 1}`,
            questionTitle: examQuestion.title,
            questionKind: examQuestion.kind,
            questionText: questionContent.question,
            answers: questionContent.answers,
            userAnswer: userAnswerObj?.selectedAnswer ?? -1,
            correctAnswer: questionContent.correctAnswer,
            userAnswerText:
              userAnswerObj?.selectedAnswer !== undefined &&
              userAnswerObj?.selectedAnswer !== null &&
              userAnswerObj?.selectedAnswer >= 0
                ? questionContent.answers?.[userAnswerObj.selectedAnswer] ??
                  "N/A"
                : "Chưa chọn đáp án",
            correctAnswerText:
              questionContent.answers?.[questionContent.correctAnswer] ?? "N/A",
            isCorrect: userAnswerObj?.isCorrect ?? false,
            explain: questionContent.explain,
            explainAll: questionContent.explainAll,
            image: questionContent.image,
            score: this.getQuestionScore(examQuestion, contentIdx),
            level: examQuestion.level,
            generalInfo: examQuestion.general
              ? {
                  audio: examQuestion.general.audio,
                  image: examQuestion.general.image,
                  txt_read: examQuestion.general.txt_read,
                  audios: examQuestion.general.audios,
                }
              : undefined,
          };

          questions.push(comparison);
        }
      }

      parts.push({
        partId: partIdValue.toString(),
        partTitle: partInfo?.name || `Part ${parts.length + 1}`,
        score: ua.score,
        maxScore: Number(partInfo?.max_score) || 0,
        questions,
      });
    }

    return {
      examResultId,
      totalScore: examResult.total_score,
      maxScore: fallbackMaxScore,
      passed: examResult.passed,
      duration: examResult.duration,
      parts,
    };
  }

  async submitExam(examResultId: string, userId: string): Promise<ExamResult> {
    const examResult = await this.examResultModel.findById(examResultId);
    if (!examResult) throw new Error("ExamResult not found");

    // Nếu đã submit rồi thì chặn
    if (examResult.status === ExamStatus.COMPLETED) {
      throw new Error("This exam has already been submitted");
    }

    // Lấy user answers
    const userAnswers = await this.examUserAnswerModel.find({
      examResultId: new Types.ObjectId(examResultId),
      userId: new Types.ObjectId(userId),
    });

    if (!userAnswers || userAnswers.length === 0) {
      throw new Error("No answers found for this exam");
    }

    const exam = await this.examModel.findById(examResult.examId).lean();
    let totalScore = 0;
    const detailIds: Types.ObjectId[] = [];

    // Tính điểm từng phần
    for (const ua of userAnswers) {
      let partScore = 0;

      if (ua.answers && ua.answers.length > 0) {
        // Lấy tất cả questionId duy nhất
        const uniqueQuestionIds = [
          ...new Set(ua.answers.map((ans) => ans.questionId.toString())),
        ];

        const examQuestions = await this.examQuestionModel
          .find({
            _id: { $in: uniqueQuestionIds.map((id) => new Types.ObjectId(id)) },
          })
          .exec();

        // Tạo map để tra cứu nhanh
        const questionMap = new Map<string, any>();
        for (const q of examQuestions) {
          questionMap.set(q.id.toString(), q);
        }

        // Tính điểm dựa trên subQuestionIndex chính xác
        for (const ans of ua.answers) {
          const examQuestion = questionMap.get(ans.questionId.toString());
          if (!examQuestion || !examQuestion.content) continue;

          const questionContent = examQuestion.content[ans.subQuestionIndex];
          if (ans.isCorrect && questionContent) {
            partScore += this.getQuestionScore(
              examQuestion,
              ans.subQuestionIndex,
            );
          }
        }
      }

      ua.score = partScore;
      await ua.save();

      totalScore += partScore;

      const detail = await this.examResultDetailModel.create({
        examResultId,
        partId: ua.partId,
        score: partScore,
      });

      detailIds.push(detail.id);
    }

    // Cập nhật examResult
    examResult.total_score = totalScore;
    examResult.end_time = new Date();
    examResult.duration =
      (examResult.end_time.getTime() - examResult.start_time.getTime()) / 1000;
    examResult.passed = totalScore >= (Number(exam?.pass_score) || 80);
    examResult.details = detailIds;
    examResult.status = ExamStatus.COMPLETED;

    await examResult.save();

    const examLevel = exam?.level || "N5";
    const examTitle = exam?.title || "bài thi JLPT";
    this.userActivitiesService.createSafely({
      userId,
      type: UserActivityType.EXAM_COMPLETED,
      title: `Đã hoàn thành đề thi ${examLevel}: ${examTitle}`,
      targetType: UserActivityTargetType.EXAM_RESULT,
      targetId: examResult._id as Types.ObjectId,
      routeParams: {
        level: examLevel,
        testId: String(examResult.examId),
        examResultId: String(examResult._id),
      },
      metadata: {
        score: totalScore,
        passed: examResult.passed,
        duration: examResult.duration,
        examTitle,
      },
    }, "Failed to create exam activity:");

    const populated = await this.examResultModel
      .findById(examResultId)
      .populate({
        path: "details",
        model: "ExamResultDetail",
        populate: {
          path: "partId",
          model: "ExamPart",
        },
      })
      .exec();

    if (!populated) {
      throw new Error("Unexpected: populated exam result is null");
    }

    return populated as unknown as ExamResult;
  }

  private getQuestionScore(
    examQuestion: Pick<ExamQuestion, "scores">,
    subQuestionIndex: number,
  ): number {
    const scoreFromScores = Number(examQuestion.scores?.[subQuestionIndex]);
    if (Number.isFinite(scoreFromScores) && scoreFromScores > 0) {
      return scoreFromScores;
    }

    return 1;
  }

  private async getExamMaxScore(
    examId: Types.ObjectId,
    fallbackScore: number,
  ): Promise<number> {
    if (Number.isFinite(fallbackScore) && fallbackScore > 0) return fallbackScore;

    const parts = await this.examPartModel
      .find({ examId }, { max_score: 1 })
      .lean()
      .exec();
    const partTotal = parts.reduce(
      (sum, part: any) => sum + (Number(part.max_score) || 0),
      0,
    );

    return partTotal || 180;
  }
}
