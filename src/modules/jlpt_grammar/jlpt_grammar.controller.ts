import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Put,
  Delete,
  Param,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { JlptGrammarService } from "./jlpt_grammar.service";
import { CreateJlptGrammarDto } from "./dto/create-jlpt-grammar.dto";

@Controller("jlpt-grammar")
export class JlptGrammarController {
  constructor(private jlptGrammarService: JlptGrammarService) {}

  @Public()
  @Post()
  async create(@Body() createData: CreateJlptGrammarDto) {
    return this.jlptGrammarService.createJlptGrammar(createData);
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
}
