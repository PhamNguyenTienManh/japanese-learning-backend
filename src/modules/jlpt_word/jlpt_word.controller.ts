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
import { JlptWordService } from "./jlpt_word.service";
import { CreateJlptWordDto } from "./dto/create-jlpt-word.dto";
import { Public } from "../auth/public.decorator";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { ExcelFile } from "../dictionary-excel/dictionary-excel.util";

@Controller("jlpt-word")
export class JlptWordController {
  constructor(private jlptWordService: JlptWordService) {}

  // CREATE
  @Public()
  @Post()
  async create(@Body() createData: CreateJlptWordDto) {
    return this.jlptWordService.createJlptWord(createData);
  }

  // BULK IMPORT (from Excel) - validate, skip duplicates
  @Public()
  @Post("import")
  async importWords(@Body() body: { items: any[] }) {
    return this.jlptWordService.bulkImportWords(body?.items ?? []);
  }

  @Public()
  @Post("import-file")
  @UseInterceptors(FileInterceptor("file"))
  async importWordsFile(@UploadedFile() file: { buffer?: Buffer }) {
    return this.jlptWordService.importWordsExcel(file);
  }

  @Public()
  @Get("template")
  async downloadTemplate(@Res() res: Response) {
    this.sendExcel(res, this.jlptWordService.buildWordTemplateExcel());
  }

  @Public()
  @Get("export")
  async exportWords(@Res() res: Response) {
    this.sendExcel(res, await this.jlptWordService.exportWordsExcel());
  }

  // DETAIL
  @Public()
  @Get("detail")
  async getDetailWord(@Query("word") word: string) {
    return this.jlptWordService.getDetailWord(word);
  }

  // SEARCH (user-facing)
  @Public()
  @Get("search")
  async searchJlptWords(
    @Query("q") q = "",
    @Query("keyword") keyword = "",
    @Query("limit") limit = 20
  ) {
    return this.jlptWordService.searchJlptWords(q || keyword, +limit);
  }

  // LIST
  @Public()
  @Get()
  async getJlptWords(
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("level") level?: string
  ) {
    return this.jlptWordService.getJlptWordsPaginated(+page, +limit, level);
  }

  @Public()
  @Get("admin")
  async getJlptWordsForAdmin(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("level") level?: string,
    @Query("q") q?: string,
    @Query("includeDeleted") includeDeleted = "true"
  ) {
    return this.jlptWordService.getJlptWordsForAdmin(
      +page,
      +limit,
      level,
      q,
      includeDeleted === "true"
    );
  }

  @Public()
  @Get("admin/:id")
  async getJlptWordForAdminById(@Param("id") id: string) {
    return this.jlptWordService.getJlptWordForAdminById(id);
  }

  // UPDATE (needed by frontend)
  @Public()
  @Put(":id")
  async updateJlptWord(
    @Param("id") id: string,
    @Body() updateData: Partial<CreateJlptWordDto>
  ) {
    return this.jlptWordService.updateJlptWord(id, updateData);
  }

  // DELETE (soft delete)
  @Public()
  @Delete(":id")
  async deleteJlptWord(@Param("id") id: string) {
    return this.jlptWordService.deleteJlptWord(id);
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
