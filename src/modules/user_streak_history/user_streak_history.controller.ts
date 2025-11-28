import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { UserStreakHistoryService } from './user_streak_history.service';


@Controller('streak')
export class UserStreakHistoryController {
  constructor(private readonly streakService: UserStreakHistoryService) {}

  /**
   * Gọi khi user học trong ngày
   */
  @Post('update')
  async updateStreak(@Req() req: any) {
    const userId = req.user?.sub;
    return this.streakService.updateStreak(userId);
  }

  /**
   * Lấy streak hiện tại
   */
  @Get('current')
  async getCurrent(@Req() req: any) {
    const userId = req.user?.sub;
    return this.streakService.getCurrentStreak(userId);
  }

  /**
   * Lấy streak dài nhất
   */
  @Get('longest')
  async getLongest(@Req() req: any) {
    const userId = req.user?.sub;
    return this.streakService.getLongestStreak(userId);
  }

  /**
   * Lịch sử streak
   */
  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user?.sub;
    return this.streakService.getStreakHistory(userId);
  }
}
