import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExamUserAnswer, UserAnswer } from './schemas/exam_user_answers.schema';
import { ExamQuestion } from '../exam_question/schemas/exam_question.schema';
import { SaveAnswersDto } from './dto/answer.dto';


@Injectable()
export class ExamUserAnswersService {
    constructor(
        @InjectModel(ExamUserAnswer.name) private examUserAnswerModel: Model<ExamUserAnswer>,
        @InjectModel(ExamQuestion.name) private examQuestionModel: Model<ExamQuestion>
    ) {}

    async SaveAnswers(dto: SaveAnswersDto, userId: string) {
        const userAnswerDocs: UserAnswer[] = [];

        for (const a of dto.answers) {
            const question = await this.examQuestionModel.findById(a.questionId);
            if (!question) throw new Error(`Question ${a.questionId} not found`);

            for (const sub of a.subAnswers) {
            // Kiểm tra subQuestionIndex hợp lệ
            if (sub.subQuestionIndex < 0 || sub.subQuestionIndex >= question.content.length) {
                throw new Error(
                `subQuestionIndex ${sub.subQuestionIndex} out of range for question ${a.questionId}`
                );
            }

            const subQuestion = question.content[sub.subQuestionIndex];
            const isCorrect = subQuestion.correctAnswer === sub.selectedAnswer;

            userAnswerDocs.push({
                questionId: question.id,
                selectedAnswer: sub.selectedAnswer,
                isCorrect,
            });
            }
        }

        const updated = await this.examUserAnswerModel.findOneAndUpdate(
            {
            examResultId: new Types.ObjectId(dto.examResultId),
            partId: new Types.ObjectId(dto.partId),
            userId: new Types.ObjectId(userId),
            },
            { answers: userAnswerDocs },
            { new: true }
        );

        if (!updated) throw new Error('ExamUserAnswer not found');

        return updated;
    }

}
