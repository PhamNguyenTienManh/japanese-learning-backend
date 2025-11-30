import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
} from "@nestjs/common";
import { JlptKanjiService } from "./jlpt_kanji.service";
import { Public } from "../auth/public.decorator";
import { CreateJlptKanjiDto } from "./dto/create-jlpt-kanji.dto";

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
  // DETAIL
  // ---------------------------
  @Public()
  @Get("detail")
  async getDetailKanji(@Query("kanji") kanji: string) {
    return this.jlptKanjiService.getDetailKanji(kanji);
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
}
