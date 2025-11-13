// exam-question.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateExamQuestionDto } from './dto/create-exam-question.dto';
import { ExamQuestion } from './schemas/exam_question.schema';

@Injectable()
export class ExamQuestionService {
  constructor(
    @InjectModel(ExamQuestion.name) private examQuestionModel: Model<ExamQuestion>,
  ) {}

  async createExamQuestion(partId: string, data: CreateExamQuestionDto): Promise<ExamQuestion> {
    try {
        if (!partId) {
            throw new BadRequestException('partId is required');
        }
        const question = new this.examQuestionModel({
            ...data,
            partId: new Types.ObjectId(partId),
        });

        return await question.save();
    } catch (error) {
        throw new BadRequestException(`Failed to create exam question: ${error.message}`);
    }
  }
}
