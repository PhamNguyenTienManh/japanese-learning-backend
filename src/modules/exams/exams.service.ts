import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Exam } from './schemas/exams.schema';
import { ExamPart } from '../exams_part/schema/exams_part.schema';
import { Model } from 'mongoose';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamQuestion } from '../exam_question/schemas/exam_question.schema';

@Injectable()
export class ExamsService {
    constructor(
        @InjectModel(Exam.name) private examModel: Model<Exam>,
        @InjectModel(ExamPart.name) private examPartModel: Model<ExamPart>,
        @InjectModel(ExamQuestion.name) private examQuestionModel: Model<ExamQuestion>,
    ) {}

    async createExam(data: CreateExamDto): Promise<Exam> {
        try {
            // Kiểm tra trùng tên theo level
            const existingExam = await this.examModel.findOne({
                title: data.title,
                level: data.level,
            });

            if (existingExam) {
                throw new BadRequestException(
                    `An exam with title "${data.title}" already exists for level "${data.level}".`,
                );
            }

            // Tạo bài thi mới
            const exam = new this.examModel({
                ...data,
                score: data.score ?? 180,
                pass_score: data.pass_score ?? 80,
            });
            const savedExam = await exam.save();

            // Tạo 3 phần thi mặc định
            const parts = [
            { name: 'Từ vựng', time: 20, min_score: 19, max_score: 40 },
            { name: 'Ngữ pháp - Đọc hiểu', time: 40, min_score: 19, max_score: 80 },
            { name: 'Thi nghe', time: 30, min_score: 19, max_score: 60 },
            ];

            const partDocs = parts.map(
                (p) => new this.examPartModel({ ...p, examId: savedExam._id }),
            );

            await this.examPartModel.insertMany(partDocs);
            return savedExam;
        } catch (error) {
            throw new BadRequestException(`Failed to create exam: ${error.message}`);
        }
    }


    // Lấy thông tin chi tiết một bài thi
  async getExamDetail(examId: string) {
    const exam = await this.examModel.findById(examId).lean();
    if (!exam) throw new NotFoundException('Exam not found');

    const parts = await this.examPartModel.find({ examId }).lean();

    // 3. Lấy danh sách ExamQuestion cho từng phần
    const questions = await this.examQuestionModel
      .find({ partId: { $in: parts.map((p) => p._id) } })
      .lean();

    // Gom câu hỏi theo phần
    const partWithQuestions = parts.map((part) => ({
      ...part,
      questions: questions.filter((q) => q.partId.toString() === part._id.toString()),
    }));

    return {
      ...exam,
      parts: partWithQuestions,
    };
  }
}
