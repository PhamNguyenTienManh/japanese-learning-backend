import { Controller, Get, Query, Req } from "@nestjs/common";
import { StatisticService } from "./statistic.service";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";

@Controller("statistic")
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get("user")
  async getUserStats(@Req() req: any) {
    const userId = req.user?.sub;
    return this.statisticService.getUserStatistics(userId);
  }

  @Get("leaderboard")
  async getJlptLeaderboard(
    @Req() req: any,
    @Query("limit") limit?: string,
  ) {
    const userId = req.user?.sub;
    return this.statisticService.getJlptLeaderboard(userId, Number(limit));
  }

  @Get()
  @Roles("admin")
  async getStats() {
    return this.statisticService.getStatistics();
  }

  @Get("admin-dashboard")
  @Roles("admin")
  async getAdminDashboard() {
    return this.statisticService.getAdminDashboard();
  }
}
