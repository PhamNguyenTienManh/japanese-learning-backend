import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Exam } from './schemas/exams.schema';
import { ExamPart } from '../exams_part/schema/exams_part.schema';
import { Model, Types } from 'mongoose';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamQuestion } from '../exam_question/schemas/exam_question.schema';

 const VALID_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
@Injectable()
export class ExamsService {
    constructor(
        @InjectModel(Exam.name) private examModel: Model<Exam>,
        @InjectModel(ExamPart.name) private examPartModel: Model<ExamPart>,
        @InjectModel(ExamQuestion.name) private examQuestionModel: Model<ExamQuestion>,
    ) {}

    async createExam(data: CreateExamDto): Promise<any> {
      try {
          // Check trùng tên theo level
          const existingExam = await this.examModel.findOne({
              title: data.title,
              level: data.level,
          });

          if (existingExam) {
              throw new BadRequestException(
                  `An exam with title "${data.title}" already exists for level "${data.level}".`,
              );
          }

          // Auto pass_score theo cấp độ
          const levelPassScore = {
              N5: 80,
              N4: 90,
              N3: 95,
              N2: 90,
              N1: 100,
          };

          const passScore = data.pass_score ?? levelPassScore[data.level] ?? 80;

          // Tạo exam
          const exam = new this.examModel({
              ...data,
              score: 180,
              pass_score: passScore,
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

          const createdParts = await this.examPartModel.insertMany(partDocs);

          // Trả về exam + partId
          return {
              exam: savedExam,
              parts: createdParts.map(p => ({
                  id: p._id,
                  name: p.name,
              })),
          };

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


  async countExamsByLevel() {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const result = {};
    for (const lv of levels) {
      const count = await this.examModel.countDocuments({ level: lv });
      result[lv] = count;
    }
    return result;
  }


  async getExamsByLevel(level: string): Promise<Exam[]> {
    // Nếu level = "all" → lấy hết
    if (level === "all") {
      const exams = await this.examModel.find({});
      return exams;
    }

    // Các level hợp lệ
    if (!VALID_LEVELS.includes(level)) {
      throw new BadRequestException(
        `Level không hợp lệ. Vui lòng nhập một trong: ${VALID_LEVELS.join(', ')} hoặc 'all'`
      );
    }

    // Filter theo level
    const exams = await this.examModel.find({ level });

    if (!exams.length) {
      throw new NotFoundException(`Không tìm thấy đề thi cho level ${level}`);
    }

    return exams;
  }

  async getExamDetailsGroupedByPart(examId: string) {
    // Kiểm tra examId hợp lệ
    if (!Types.ObjectId.isValid(examId)) {
      throw new NotFoundException('Exam ID không hợp lệ');
    }

    // Lấy tất cả phần của đề thi
    const objectId = new Types.ObjectId(examId);

    const parts = await this.examPartModel.find({ examId: objectId }).lean();
    if (!parts.length) {
      throw new NotFoundException('Không tìm thấy phần thi nào cho đề này');
    }


    // Lấy tất cả câu hỏi thuộc các phần này
    const partIds = parts.map((p) => p._id);
    const questions = await this.examQuestionModel.find({ partId: { $in: partIds } }).lean();

    // Gom nhóm theo partId
    const grouped = parts.map((part) => {
      const partQuestions = questions.filter((q) => q.partId.toString() === part._id.toString());
      return {
        partId: part._id,
        partName: part.name,
        time: part.time,
        min_score: part.min_score,
        max_score: part.max_score,
        questions: partQuestions,
      };
    });

    return grouped;
  }
}
