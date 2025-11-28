import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserStreakHistory } from '../user_streak_history/schemas/user_streak_history.schema';
import { UserStudyDay } from '../user_study_day/schemas/user_study_day.schema';
import { ExamResult } from '../exam_results/schemas/exam_results.schema';
import { Profile } from '../profiles/schemas/profiles.schema';

interface ProfileLean {
  userId: Types.ObjectId;
  name: string;
  image_url?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StatisticService {
  constructor(
    @InjectModel(UserStreakHistory.name)
    private streakModel: Model<UserStreakHistory>,

    @InjectModel(UserStudyDay.name)
    private studyDayModel: Model<UserStudyDay>,

    @InjectModel(ExamResult.name)
    private examResultModel: Model<ExamResult>,

    @InjectModel(Profile.name)
    private profileModel: Model<Profile>,
  ) {}

  async getUserStatistics(userId: string) {
    const objectId = new Types.ObjectId(userId);

    // Lấy thông tin user
    const profile = await this.profileModel
      .findOne({ userId: objectId })
      .lean<ProfileLean>();

    if (!profile) throw new Error('Profile not found');
    
    // Tổng số ngày học
    const studyDaysCount = await this.studyDayModel.countDocuments({ 
      user_id: userId  //
    });

    // Chuỗi hiện tại & dài nhất
    const streaks = await this.streakModel
      .find({ user_id: userId })  //
      .sort({ streak_count: -1 });
    
    const currentStreak = streaks.find(s => s.is_current)?.streak_count || 0;
    const longestStreak = streaks.length > 0 ? streaks[0].streak_count : 0;

    // Tổng thời gian học tuần này
    const today = new Date();
    const dayOfWeek = today.getDay(); // Chủ nhật = 0
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekRecords = await this.studyDayModel.find({
      user_id: userId, 
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });
    
    const totalStudyTimePerWeek = weekRecords.reduce(
      (sum, r) => sum + r.duration_minutes, 
      0
    );

    
    const examResults = await this.examResultModel.find({
      userId: objectId,
      status: 'completed',
    });
    
    const testsCompleted = examResults.length;
    const averageScore = testsCompleted > 0
        ? parseFloat((examResults.reduce((sum, r) => sum + r.total_score, 0) / testsCompleted).toFixed(2))
        : 0;

    // Số lượng từ, kanji học (tạm mock)
    const wordsLearned = 0;
    const kanjiLearned = 0;

    return {
      name: profile.name || '',
      avatar: profile.image_url || '/current-user.jpg',
      joinedDate: profile.createdAt || null,
      stats: {
        studyDays: studyDaysCount,
        currentStreak,
        longestStreak,
        totalStudyTimePerWeek,
        wordsLearned,
        kanjiLearned,
        testsCompleted,
        averageScore,
      },
    };
  }
}