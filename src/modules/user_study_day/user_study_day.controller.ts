import { Controller, Get, Post, Req, Body } from '@nestjs/common';
import { UserStudyDayService } from './user_study_day.service';


@Controller('study-day')
export class UserStudyDayController {
  constructor(private readonly studyDayService: UserStudyDayService) {}

  /**
   * Cập nhật số phút học
   * body: { minutes: number }
   */
  @Post('add')
  async addStudyTime(@Req() req: any, @Body() body: { minutes: number }) {
    const userId = req.user?.sub;
    const minutes = body.minutes || 0;

    return this.studyDayService.addStudyTime(userId, minutes);
  }

  /**
   * Lấy số phút học hôm nay
   */
  @Get('today')
  async getToday(@Req() req: any) {
    const userId = req.user?.sub;
    return this.studyDayService.getStudyTimeOfDay(userId);
  }

  /**
   * Lấy tổng số phút học trong tuần
   */
  @Get('week')
  async getWeek(@Req() req: any) {
    const userId = req.user?.sub;
    return this.studyDayService.getStudyTimeOfWeek(userId);
  }

  /**
   * Lấy tổng số phút học trong tháng
   */
  @Get('month')
  async getMonth(@Req() req: any) {
    const userId = req.user?.sub;
    return this.studyDayService.getStudyTimeOfMonth(userId);
  }

  @Get('week-time')
  async getWeekHours(@Req() req: any) {
    const userId = req.user?.sub;
    return this.studyDayService.getWeekStudyMinutes(userId);
  }
}
