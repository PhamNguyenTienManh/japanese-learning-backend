import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { ConversationService } from "./conversation.service";
import { Roles } from "../auth/roles.decorator";

@Controller("conversation")
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @Public()
  getList() {
    return this.conversationService.getList();
  }

  @Get("admin/all")
  @Roles("admin")
  getAdminData() {
    return this.conversationService.getAdminData();
  }

  @Post("admin/categories")
  @Roles("admin")
  createCategory(@Body() body: any) {
    return this.conversationService.createCategory(body);
  }

  @Patch("admin/categories/:id")
  @Roles("admin")
  updateCategory(@Param("id") id: string, @Body() body: any) {
    return this.conversationService.updateCategory(id, body);
  }

  @Delete("admin/categories/:id")
  @Roles("admin")
  deleteCategory(@Param("id") id: string) {
    return this.conversationService.deleteCategory(id);
  }

  @Post("admin/lessons")
  @Roles("admin")
  createLesson(@Body() body: any) {
    return this.conversationService.createLesson(body);
  }

  @Patch("admin/lessons/:id")
  @Roles("admin")
  updateLesson(@Param("id") id: string, @Body() body: any) {
    return this.conversationService.updateLesson(id, body);
  }

  @Delete("admin/lessons/:id")
  @Roles("admin")
  deleteLesson(@Param("id") id: string) {
    return this.conversationService.deleteLesson(id);
  }

  @Get(":idOrSlug")
  @Public()
  getDetail(@Param("idOrSlug") idOrSlug: string) {
    return this.conversationService.getDetail(idOrSlug);
  }
}
