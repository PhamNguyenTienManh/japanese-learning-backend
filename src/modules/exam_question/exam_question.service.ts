// exam-question.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

  async deleteExamQuestion(questionId: string) {
    try {
      if (!Types.ObjectId.isValid(questionId)) {
        throw new BadRequestException('Invalid questionId');
      }

      const deleted = await this.examQuestionModel.findByIdAndDelete(
        questionId,
      );

      if (!deleted) {
        throw new NotFoundException('Exam question not found');
      }

      return {
        message: 'Exam question deleted successfully',
        deleted,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete exam question: ${error.message}`,
      );
    }
  }


  async updateExamQuestion(
    questionId: string,
    data: Partial<CreateExamQuestionDto>,
  ): Promise<ExamQuestion> {
    try {
      if (!Types.ObjectId.isValid(questionId)) {
        throw new BadRequestException('Invalid questionId');
      }

      const updated = await this.examQuestionModel.findByIdAndUpdate(
        questionId,
        { $set: data },
        { new: true },
      );

      if (!updated) {
        throw new NotFoundException('Exam question not found');
      }

      return updated;
    } catch (error) {
      throw new BadRequestException(
        `Failed to update exam question: ${error.message}`,
      );
    }
  }


}
