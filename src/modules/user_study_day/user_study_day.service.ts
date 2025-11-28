import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserStudyDay } from './schemas/user_study_day.schema';


@Injectable()
export class UserStudyDayService {
  constructor(
    @InjectModel(UserStudyDay.name)
    private studyDayModel: Model<UserStudyDay>,
  ) {}

  /**
   * Cập nhật số phút học cho ngày hôm nay
   */
  async addStudyTime(userId: string, minutes: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // chỉ lấy phần date

    let record = await this.studyDayModel.findOne({ user_id: userId, date: today });

    if (!record) {
      record = await this.studyDayModel.create({
        user_id: userId,
        date: today,
        duration_minutes: minutes,
      });
    } else {
      record.duration_minutes += minutes;
      await record.save();
    }

    return record;
  }

  /**
   * Lấy tổng số phút học trong ngày
   */
  async getStudyTimeOfDay(userId: string, date: Date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    return this.studyDayModel.findOne({ user_id: userId, date: d });
  }

  /**
   * Lấy tổng số phút học trong tuần
   */
  async getStudyTimeOfWeek(userId: string, referenceDate: Date = new Date()) {
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // thứ 2
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // chủ nhật
    endOfWeek.setHours(23, 59, 59, 999);

    const records = await this.studyDayModel.find({
      user_id: userId,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    return records.reduce((sum, r) => sum + r.duration_minutes, 0);
  }

  /**
   * Lấy tổng số phút học trong tháng
   */
  async getStudyTimeOfMonth(userId: string, referenceDate: Date = new Date()) {
    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const records = await this.studyDayModel.find({
      user_id: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    return records.reduce((sum, r) => sum + r.duration_minutes, 0);
  }

   async getWeekStudyMinutes(userId: string) {
        const today = new Date();
        // Xác định thứ 2 đầu tuần
        const dayOfWeek = today.getDay(); // Chủ nhật = 0, thứ 2 = 1
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; 
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() + diffToMonday);
        startOfWeek.setHours(0,0,0,0);

        // Chủ nhật cuối tuần
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        // Lấy tất cả record trong tuần
        const records = await this.studyDayModel.find({
            user_id: userId,
            date: { $gte: startOfWeek, $lte: endOfWeek }
        });

        // Tạo mảng 7 phần tử mặc định là 0
        const weekMinutes = Array(7).fill(0);

        // Map từng record vào đúng thứ
        records.forEach(r => {
            const d = new Date(r.date);
            const index = (d.getDay() === 0 ? 6 : d.getDay() - 1); // Thứ 2 = 0, CN = 6
            weekMinutes[index] = r.duration_minutes; // để phút luôn
        });

        return weekMinutes; // [thứ2, thứ3, thứ4, thứ5, thứ6, thứ7, CN] (số phút)
    }


}
