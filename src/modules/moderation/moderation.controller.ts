import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { CreatePostReportDto } from "./dto/create-post-report.dto";
import { UpdateModerationSettingDto } from "./dto/update-moderation-setting.dto";
import { ModerationService } from "./moderation.service";

@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("cases")
  @Roles("admin")
  listCases(
    @Query("status") status?: string,
    @Query("targetType") targetType?: string,
    @Query("source") source?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.moderationService.listCases({
      status,
      targetType,
      source,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get("cases/counts")
  @Roles("admin")
  getCaseCounts() {
    return this.moderationService.getCaseCounts();
  }

  @Get("metrics/post-ai")
  @Roles("admin")
  getPostAiMetrics(@Query("range") range = "30d") {
    return this.moderationService.getPostAiMetrics(range);
  }

  @Post("reports/posts/:postId")
  reportPost(
    @Param("postId") postId: string,
    @Req() req: any,
    @Body() dto: CreatePostReportDto,
  ) {
    return this.moderationService.reportPost(postId, req.user?.sub, dto);
  }

  @Post("reports/comments/:commentId")
  reportComment(
    @Param("commentId") commentId: string,
    @Req() req: any,
    @Body() dto: CreatePostReportDto,
  ) {
    return this.moderationService.reportComment(commentId, req.user?.sub, dto);
  }

  @Post("admin/posts/:postId/delete")
  @Roles("admin")
  deletePostWithReason(
    @Param("postId") postId: string,
    @Req() req: any,
    @Body() dto: CreatePostReportDto,
  ) {
    return this.moderationService.deletePostWithReason(postId, req.user?.sub, dto);
  }

  @Post("admin/comments/:commentId/delete")
  @Roles("admin")
  deleteCommentWithReason(
    @Param("commentId") commentId: string,
    @Req() req: any,
    @Body() dto: CreatePostReportDto,
  ) {
    return this.moderationService.deleteCommentWithReason(commentId, req.user?.sub, dto);
  }

  @Patch("cases/:id/delete")
  @Roles("admin")
  deleteCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.deleteCase(id, req.user?.sub);
  }

  @Patch("cases/:id/dismiss")
  @Roles("admin")
  dismissCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.dismissCase(id, req.user?.sub);
  }

  @Patch("cases/:id/restore")
  @Roles("admin")
  restoreCase(@Param("id") id: string, @Req() req: any) {
    return this.moderationService.restoreCase(id, req.user?.sub);
  }

  @Get("settings")
  @Roles("admin")
  getSettings() {
    return this.moderationService.getSettings();
  }

  @Put("settings")
  @Roles("admin")
  updateSettings(@Body() dto: UpdateModerationSettingDto) {
    return this.moderationService.updateSettings(dto);
  }
}
