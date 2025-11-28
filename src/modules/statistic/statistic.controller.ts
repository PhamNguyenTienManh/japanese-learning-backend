import { Controller, Get, Req } from '@nestjs/common';
import { StatisticService } from './statistic.service';

@Controller('statistic')
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get('user')
  async getUserStats(@Req() req: any) {
    const userId = req.user?.sub;
    return this.statisticService.getUserStatistics(userId);
  }
}
