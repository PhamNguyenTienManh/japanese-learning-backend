import { Body, Controller, Get, Param, Patch, Put, Query, Req } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { UpdateModerationSettingDto } from "./dto/update-moderation-setting.dto";
import { ModerationService } from "./moderation.service";

@Controller("moderation")
@Roles("admin")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("cases")
  listCases(
    @Query("status") status?: string,
    @Query("targetType") targetType?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.moderationService.listCases({
      status,
      targetType,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Patch("cases/:id/delete")
  deleteCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.deleteCase(id, req.user?.sub);
  }

  @Patch("cases/:id/dismiss")
  dismissCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.dismissCase(id, req.user?.sub);
  }

  @Patch("cases/:id/restore")
  restoreCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.restoreCase(id, req.user?.sub);
  }

  @Get("settings")
  getSettings() {
    return this.moderationService.getSettings();
  }

  @Put("settings")
  updateSettings(@Body() dto: UpdateModerationSettingDto) {
    return this.moderationService.updateSettings(dto);
  }
}
