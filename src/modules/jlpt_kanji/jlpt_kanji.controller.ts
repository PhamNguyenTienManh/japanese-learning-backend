import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
} from "@nestjs/common";
import { JlptKanjiService } from "./jlpt_kanji.service";
import { Public } from "../auth/public.decorator";
import { CreateJlptKanjiDto } from "./dto/create-jlpt-kanji.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { ExcelFile } from "../dictionary-excel/dictionary-excel.util";

@Controller("jlpt-kanji")
export class JlptKanjiController {
  constructor(private jlptKanjiService: JlptKanjiService) {}

  // ---------------------------
  // CREATE
  // ---------------------------
  @Public()
  @Post()
  async create(@Body() createData: CreateJlptKanjiDto) {
    return this.jlptKanjiService.createJlptKanji(createData);
  }

  // ---------------------------
  // BULK IMPORT (from Excel)
  // ---------------------------
  @Public()
  @Post("import")
  async importKanji(@Body() body: { items: any[] }) {
    return this.jlptKanjiService.bulkImportKanji(body?.items ?? []);
  }

  @Public()
  @Post("import-file")
  @UseInterceptors(FileInterceptor("file"))
  async importKanjiFile(@UploadedFile() file: { buffer?: Buffer }) {
    return this.jlptKanjiService.importKanjiExcel(file);
  }

  @Public()
  @Get("template")
  async downloadTemplate(@Res() res: Response) {
    this.sendExcel(res, this.jlptKanjiService.buildKanjiTemplateExcel());
  }

  @Public()
  @Get("export")
  async exportKanji(@Res() res: Response) {
    this.sendExcel(res, await this.jlptKanjiService.exportKanjiExcel());
  }

  // ---------------------------
  // DETAIL
  // ---------------------------
  @Public()
  @Get("detail")
  async getDetailKanji(@Query("kanji") kanji: string) {
    return this.jlptKanjiService.getDetailKanji(kanji);
  }

  @Public()
  @Get("search")
  async searchJlptKanji(
    @Query("q") q = "",
    @Query("keyword") keyword = "",
    @Query("limit") limit = 20
  ) {
    return this.jlptKanjiService.searchJlptKanji(q || keyword, +limit);
  }

  // ---------------------------
  // USER LIST (formatted)
  // ---------------------------
  @Public()
  @Get()
  async getJlptKanji(
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("level") level?: string
  ) {
    return this.jlptKanjiService.getJlptKanjiPaginated(+page, +limit, level);
  }

  // ---------------------------
  // ADMIN LIST (raw full data)
  // ---------------------------
  @Public()
  @Get("admin")
  async getJlptKanjiForAdmin(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("level") level?: string,
    @Query("q") q?: string,
    @Query("includeDeleted") includeDeleted = "true"
  ) {
    return this.jlptKanjiService.getJlptKanjiForAdmin(
      +page,
      +limit,
      level,
      q,
      includeDeleted === "true"
    );
  }

  @Public()
  @Get("admin/:id")
  async getJlptKanjiForAdminById(@Param("id") id: string) {
    return this.jlptKanjiService.getJlptKanjiForAdminById(id);
  }

  // ---------------------------
  // UPDATE KANJI
  // ---------------------------
  @Public()
  @Put(":id")
  async updateJlptKanji(
    @Param("id") id: string,
    @Body() updateData: Partial<CreateJlptKanjiDto>
  ) {
    return this.jlptKanjiService.updateJlptKanji(id, updateData);
  }

  // ---------------------------
  // DELETE KANJI (soft delete)
  // ---------------------------
  @Public()
  @Delete(":id")
  async deleteJlptKanji(@Param("id") id: string) {
    return this.jlptKanjiService.deleteJlptKanji(id);
  }

  private sendExcel(res: Response, file: ExcelFile) {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
