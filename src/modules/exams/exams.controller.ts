import { Body, Controller, Get, Param, Patch, Post, Req, ForbiddenException } from "@nestjs/common";
import { ExamsService } from "./exams.service";
import { Public } from "../auth/public.decorator";
import { CreateExamDto } from "./dto/create-exam.dto";
import { UpdateExamDto } from "./dto/update_exam.dto";
import { Roles } from "../auth/roles.decorator";

@Controller("exams")
export class ExamsController {
  constructor(private readonly examService: ExamsService) {}

  @Roles("admin")
  @Post()
  async createExam(@Body() createExamDto: CreateExamDto) {
    return this.examService.createExam(createExamDto);
  }

  // exam.controller.ts
  @Public()
  @Get("count-by-level")
  async getCountByLevel() {
    return this.examService.countExamsByLevel();
  }

  @Public()
  @Get("level/:level")
  async getExamsByLevel(@Param("level") level: string, @Req() req: any) {
    const upperLevel = level.toUpperCase();
    if (["N1", "N2", "N3"].includes(upperLevel)) {
      const user = req.user;
      if (!user) throw new ForbiddenException("Bạn cần đăng nhập gói Pro để xem các đề thi này.");
      if (user.role !== "admin" && !user.isPremium) {
        if (!user.premiumExpiredDate || new Date(user.premiumExpiredDate).getTime() < Date.now()) {
          throw new ForbiddenException("Tính năng này chỉ dành cho tài khoản Pro.");
        }
      }
    }
    return this.examService.getExamsByLevel(level);
  }

  @Public()
  @Get(":id")
  async getExamDetail(@Param("id") id: string, @Req() req: any) {
    const exam = await this.examService.getExamDetail(id);
    if (!exam) throw new ForbiddenException("Không tìm thấy bài thi.");

    const upperLevel = (exam.level || "").toUpperCase();
    if (["N1", "N2", "N3"].includes(upperLevel)) {
      const user = req.user;
      if (!user) throw new ForbiddenException("Bạn cần đăng nhập gói Pro để xem đề thi này.");
      if (user.role !== "admin" && !user.isPremium) {
        if (!user.premiumExpiredDate || new Date(user.premiumExpiredDate).getTime() < Date.now()) {
          throw new ForbiddenException("Tính năng này chỉ dành cho tài khoản Pro.");
        }
      }
    }
    return this.examService.getExamDetailsGroupedByPart(id);
  }

  @Roles("admin")
  @Patch(":id")
  async updateExam(
    @Param("id") id: string,
    @Body() updateExamDto: UpdateExamDto
  ) {
    return this.examService.updateExam(id, updateExamDto);
  }
}
