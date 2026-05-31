import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Put,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Res,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { JlptGrammarService } from "./jlpt_grammar.service";
import { CreateJlptGrammarDto } from "./dto/create-jlpt-grammar.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type { ExcelFile } from "../dictionary-excel/dictionary-excel.util";

@Controller("jlpt-grammar")
export class JlptGrammarController {
  constructor(private jlptGrammarService: JlptGrammarService) {}

  @Public()
  @Post()
  async create(@Body() createData: CreateJlptGrammarDto) {
    return this.jlptGrammarService.createJlptGrammar(createData);
  }

  // BULK IMPORT (from Excel) - validate, skip duplicates
  @Public()
  @Post("import")
  async importGrammar(@Body() body: { items: any[] }) {
    return this.jlptGrammarService.bulkImportGrammar(body?.items ?? []);
  }

  @Public()
  @Post("import-file")
  @UseInterceptors(FileInterceptor("file"))
  async importGrammarFile(@UploadedFile() file: { buffer?: Buffer }) {
    return this.jlptGrammarService.importGrammarExcel(file);
  }

  @Public()
  @Get("template")
  async downloadTemplate(@Res() res: Response) {
    this.sendExcel(res, this.jlptGrammarService.buildGrammarTemplateExcel());
  }

  @Public()
  @Get("export")
  async exportGrammar(@Res() res: Response) {
    this.sendExcel(res, await this.jlptGrammarService.exportGrammarExcel());
  }

  @Public()
  @Get("detail")
  async getDetailGrammar(@Query("grammar") grammar: string) {
    return this.jlptGrammarService.getDetailGrammar(grammar);
  }

  @Public()
  @Get()
  async getJlptWords(
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("level") level?: string
  ) {
    return this.jlptGrammarService.getJlptGrammarPaginated(
      +page,
      +limit,
      level
    );
  }

  @Public()
  @Get("admin")
  async getGrammarForAdmin(
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("level") level?: string,
    @Query("q") q?: string,
    @Query("includeDeleted") includeDeleted = "true"
  ) {
    return this.jlptGrammarService.getGrammarForAdmin(
      +page,
      +limit,
      level,
      q,
      includeDeleted === "true"
    );
  }

  @Public()
  @Get("admin/:id")
  async getGrammarForAdminById(@Param("id") id: string) {
    return this.jlptGrammarService.getGrammarForAdminById(id);
  }

  @Public()
  @Put(":id")
  async updateGrammar(
    @Param("id") id: string,
    @Body() updateData: Partial<CreateJlptGrammarDto>
  ) {
    return this.jlptGrammarService.updateGrammar(id, updateData);
  }

  @Public()
  @Delete(":id")
  async deleteGrammar(@Param("id") id: string) {
    return this.jlptGrammarService.deleteGrammar(id);
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
