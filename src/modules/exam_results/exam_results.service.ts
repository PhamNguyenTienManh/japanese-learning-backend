import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExamResult, ExamStatus } from './schemas/exam_results.schema';
import { ExamPart } from '../exams_part/schema/exams_part.schema';
import { ExamUserAnswer} from '../exam_user_answers/schemas/exam_user_answers.schema';
import { Exam } from '../exams/schemas/exams.schema';
import { ExamResultDetail } from '../exam_results_detail/schemas/exam_results_detail.schema';



@Injectable()
export class ExamResultsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<Exam>,
    @InjectModel(ExamResult.name) private examResultModel: Model<ExamResult>,
    @InjectModel(ExamPart.name) private examPartModel: Model<ExamPart>,
    @InjectModel(ExamUserAnswer.name) private examUserAnswerModel: Model<ExamUserAnswer>,
    @InjectModel(ExamResultDetail.name) private examResultDetailModel: Model<ExamResultDetail>
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
    });

    const savedResult = await examResult.save();

    // 3. Khởi tạo UserAnswer cho từng phần của exam
    const parts = await this.examPartModel.find({ examId: new Types.ObjectId(examId),}).exec();
    console.log("Parts:", parts);
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

  // Nộp bài
    async submitExam(examResultId: string, userId: string): Promise<ExamResult> {
    const examResult = await this.examResultModel.findById(examResultId);
    if (!examResult) throw new Error('ExamResult not found');

    // Nếu đã submit rồi thì chặn
    if (examResult.status === ExamStatus.COMPLETED) {
        throw new Error('This exam has already been submitted');
    }

    // Lấy user answers
    const userAnswers = await this.examUserAnswerModel.find({
        examResultId: new Types.ObjectId(examResultId),
        userId: new Types.ObjectId(userId),
    });

    if (!userAnswers || userAnswers.length === 0) {
        throw new Error('No answers found for this exam');
    }

    let totalScore = 0;
    const detailIds: Types.ObjectId[] = [];

    // Tính điểm từng phần
    for (const ua of userAnswers) {
        let partScore = 0;

        if (ua.answers && ua.answers.length > 0) {
            for (const ans of ua.answers) {
                if (ans.isCorrect) partScore += 1;
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
            path: 'details',
            model: 'ExamResultDetail',
            populate: {
                path: 'partId',
                model: 'ExamPart',
            }
        })
        .exec();

    if (!populated) {
        throw new Error("Unexpected: populated exam result is null");
    }

    return populated as unknown as ExamResult;
}


  // --- Resume bài thi ---
    async resumeExam(examResultId: string, userId: string) {
        const examResult = await this.examResultModel.findOne({ _id: examResultId, userId });
        if (!examResult) throw new NotFoundException("ExamResult not found");

        const answers = await this.examUserAnswerModel.find({ examResultId, userId }).lean();

        const now = new Date();
        const elapsed = Math.floor((now.getTime() - examResult.start_time.getTime()) / 1000);

        return {
            examResultId,
            examId: examResult.examId,
            start_time: examResult.start_time,
            elapsed, // thời gian đã làm
            answers
        };
    }


}