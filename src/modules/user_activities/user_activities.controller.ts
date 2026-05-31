import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { UserActivitiesService } from "./user_activities.service";
import type { LogKanjiLookupInput } from "./user_activities.service";

@Controller("user-activities")
export class UserActivitiesController {
  constructor(private readonly userActivitiesService: UserActivitiesService) {}

  @Get("recent")
  async getRecent(@Req() req: any, @Query("limit") limit?: string) {
    const userId = req.user?.sub;
    return this.userActivitiesService.getRecent(userId, Number(limit));
  }

  @Get("admin/users/:userId")
  @Roles("admin")
  async getUserActivities(
    @Param("userId") userId: string,
    @Query("limit") limit?: string,
  ) {
    return this.userActivitiesService.getByUser(userId, Number(limit));
  }

  @Post("kanji-lookup")
  async logKanjiLookup(
    @Req() req: any,
    @Body() body: LogKanjiLookupInput,
  ) {
    const userId = req.user?.sub;
    this.userActivitiesService.logKanjiLookup(userId, body);
    return { success: true };
  }
}
