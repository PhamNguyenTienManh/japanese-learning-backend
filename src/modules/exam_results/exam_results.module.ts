import { Module } from '@nestjs/common';
import { ExamResultsService } from './exam_results.service';
import { ExamResultsController } from './exam_results.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamResult, ExamResultSchema } from './schemas/exam_results.schema';
import { ExamPart, ExamPartSchema } from '../exams_part/schema/exams_part.schema';
import { ExamUserAnswer, ExamUserAnswerSchema } from '../exam_user_answers/schemas/exam_user_answers.schema';
import { Exam, ExamSchema } from '../exams/schemas/exams.schema';
import { ExamResultDetail, ExamResultDetailSchema } from '../exam_results_detail/schemas/exam_results_detail.schema';
import { ExamQuestion, ExamQuestionSchema } from '../exam_question/schemas/exam_question.schema';
import { UserActivitiesModule } from '../user_activities/user_activities.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExamResult.name, schema: ExamResultSchema }]),
    MongooseModule.forFeature([{ name: ExamPart.name, schema: ExamPartSchema }]),
    MongooseModule.forFeature([{ name: ExamUserAnswer.name, schema: ExamUserAnswerSchema }]),
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
    MongooseModule.forFeature([{ name: ExamResultDetail.name, schema: ExamResultDetailSchema }]),
    MongooseModule.forFeature([{ name: ExamQuestion.name, schema: ExamQuestionSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Profile.name, schema: ProfileSchema }]),
    UserActivitiesModule,
  ],
  providers: [ExamResultsService],
  controllers: [ExamResultsController]
})
export class ExamResultsModule {}
