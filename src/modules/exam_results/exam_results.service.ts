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
    private examQuestionModel: Model<ExamQuestionModule>
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
    const examResult = await this.examResultModel.findOne({
      _id: examResultId,
      userId,
    });
    if (!examResult) throw new NotFoundException("ExamResult not found");

    const answers = await this.examUserAnswerModel
      .find({ examResultId, userId })
      .lean();

    const now = new Date();
    const elapsed = Math.floor(
      (now.getTime() - examResult.start_time.getTime()) / 1000
    );

    return {
      examResultId,
      examId: examResult.examId,
      start_time: examResult.start_time,
      elapsed, // thời gian đã làm
      answers,
    };
  }

  // Kiểm tra trạng thái bài làm của user
  async checkExamStatus(examId: string, userId: string) {
    const results = await this.examResultModel
      .find({
        examId: new Types.ObjectId(examId),
        userId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 }); // newest → oldest

    // Không có bài thi nào → chưa làm
    if (results.length === 0) {
      return { status: "not_started" };
    }

    // Lặp qua tất cả kết quả theo thứ tự mới nhất → cũ nhất
    for (const result of results) {
      if (result.status === ExamStatus.COMPLETED) {
        return {
          status: "completed",
          examResultId: result._id,
        };
      }

      if (result.status === ExamStatus.SAVING) {
        return {
          status: "saving",
          examResultId: result._id,
        };
      }

      // Nếu là in_progress → tiếp tục lặp xuống để tìm bản ghi hợp lệ
    }

    // Nếu duyệt hết mà chỉ toàn in_progress → xem như chưa làm bao giờ
    return { status: "not_started" };
  }

  async getResultDetailByExam(examId: string, userId: string) {
    // --- Lấy ExamResult mới nhất của user cho exam này ---
    const examResult = await this.examResultModel
      .findOne({
        examId: new Types.ObjectId(examId),
        userId: new Types.ObjectId(userId),
        status: ExamStatus.COMPLETED,
      })
      .sort({ createdAt: -1 }) // Lấy bản mới nhất
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

          // Tìm câu trả lời tương ứng
          const answersForThisQuestion = ua.answers.filter(
            (a) => a.questionId.toString() === questionIdStr
          );

          const userAnswerObj = answersForThisQuestion[contentIdx];

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
            score: questionContent.score ?? 0,
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
        maxScore: 180,
        questions,
      });
    }

    return {
      examResultId,
      totalScore: examResult.total_score,
      maxScore: 180,
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

        // Group answers theo questionId để xử lý
        const answersByQuestion = new Map<string, UserAnswer[]>();
        for (const ans of ua.answers) {
          const qId = ans.questionId.toString();
          if (!answersByQuestion.has(qId)) {
            answersByQuestion.set(qId, []);
          }
          answersByQuestion.get(qId)!.push(ans);
        }

        // Tính điểm cho từng nhóm câu hỏi
        for (const [questionId, answers] of answersByQuestion.entries()) {
          const examQuestion = questionMap.get(questionId);
          if (!examQuestion) continue;

          // Duyệt qua từng answer và map với content tương ứng
          for (let i = 0; i < answers.length; i++) {
            const ans = answers[i];
            if (
              ans.isCorrect &&
              examQuestion.content &&
              examQuestion.content[i]
            ) {
              const questionContent = examQuestion.content[i];
              partScore += questionContent.score || 1;
            }
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
    examResult.passed = totalScore >= 80;
    examResult.details = detailIds;
    examResult.status = ExamStatus.COMPLETED;

    await examResult.save();

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
}
