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

  async deleteExamQuestions(questionIds: string[]) {
    try {
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        throw new BadRequestException('questionIds must be a non-empty array');
      }

      const uniqueQuestionIds = [...new Set(questionIds)];
      const invalidQuestionId = uniqueQuestionIds.find(
        (questionId) => !Types.ObjectId.isValid(questionId),
      );

      if (invalidQuestionId) {
        throw new BadRequestException(`Invalid questionId: ${invalidQuestionId}`);
      }

      const objectIds = uniqueQuestionIds.map(
        (questionId) => new Types.ObjectId(questionId),
      );
      const result = await this.examQuestionModel.deleteMany({
        _id: { $in: objectIds },
      });

      return {
        message: 'Exam questions deleted successfully',
        requestedCount: uniqueQuestionIds.length,
        deletedCount: result.deletedCount,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete exam questions: ${error.message}`,
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
