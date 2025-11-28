import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserStreakHistory } from './schemas/user_streak_history.schema';


@Injectable()
export class UserStreakHistoryService {
    constructor(
        @InjectModel(UserStreakHistory.name)
        private streakModel: Model<UserStreakHistory>,
    ) {}


    async updateStreak(userId: string, studyDate: Date = new Date()) {
        const today = this.toDateOnly(studyDate);

        // Lấy streak hiện tại
        let currentStreak = await this.streakModel.findOne({
            user_id: userId,
            is_current: true,
        });

        // Nếu chưa có streak -> tạo streak mới
        if (!currentStreak) {
        return this.startNewStreak(userId, today);
        }

        const lastActive = this.toDateOnly(currentStreak.last_active_date);

        // Nếu đã học hôm nay không tăng streak
        if (this.isSameDay(lastActive, today)) {
            return currentStreak;
        }

        // Nếu học liên tiếp (hôm qua)
        if (this.isYesterday(lastActive, today)) {
            currentStreak.streak_count += 1;
            currentStreak.last_active_date = today;
            currentStreak.end_date = today;
            await currentStreak.save();
            return currentStreak;
        }

        // Nếu bỏ học >= 2 ngày thì đóng streak cũ, bắt đầu streak mới
        await this.endStreak(currentStreak, lastActive);
        return this.startNewStreak(userId, today);
    }


    // Tạo streak mới
    async startNewStreak(userId: string, startDate: Date) {
        return this.streakModel.create({
        user_id: userId,
        streak_count: 1,
        start_date: startDate,
        end_date: startDate,
        is_current: true,
        last_active_date: startDate,
        });
    }

  //Đóng streak hiện tại
    async endStreak(streak: UserStreakHistory, endDate: Date) {
        streak.is_current = false;
        streak.end_date = endDate;
        await streak.save();
    }

 
    //Lấy streak hiện tại   
    async getCurrentStreak(userId: string) {
        return this.streakModel.findOne({
        user_id: userId,
        is_current: true,
        });
    }

  
    //Lấy streak dài nhất
    async getLongestStreak(userId: string) {
        return this.streakModel
        .find({ user_id: userId })
        .sort({ streak_count: -1 })
        .limit(1);
    }


    //Lấy lịch sử streak
    async getStreakHistory(userId: string) {
        return this.streakModel
        .find({ user_id: userId })
        .sort({ start_date: -1 });
    }

  private toDateOnly(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(d1: Date, d2: Date) {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private isYesterday(d1: Date, d2: Date) {
    const diff =
      this.toDateOnly(d2).getTime() - this.toDateOnly(d1).getTime();
    return diff === 24 * 60 * 60 * 1000;
  }
}
