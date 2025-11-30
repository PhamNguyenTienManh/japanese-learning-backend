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
import { JlptWordService } from "./jlpt_word.service";
import { CreateJlptWordDto } from "./dto/create-jlpt-word.dto";
import { Public } from "../auth/public.decorator";

@Controller("jlpt-word")
export class JlptWordController {
  constructor(private jlptWordService: JlptWordService) {}

  // CREATE
  @Public()
  @Post()
  async create(@Body() createData: CreateJlptWordDto) {
    return this.jlptWordService.createJlptWord(createData);
  }

  // DETAIL
  @Public()
  @Get("detail")
  async getDetailWord(@Query("word") word: string) {
    return this.jlptWordService.getDetailWord(word);
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
}
