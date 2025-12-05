import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { NewsService } from "./news.service";
import { CreateNewsDto } from "./dto/create-new.dto";
import { News } from "./schemas/news.schema";
import { Public } from "../auth/public.decorator";
import { UpdateNewsDto } from "./dto/update-new.dto";
import { Roles } from "../auth/roles.decorator";

@Controller("news")
export class NewsController {
  constructor(private readonly newService: NewsService) {}

  @Post()
  @Roles("admin")
  async create(@Body() dto: CreateNewsDto): Promise<News> {
    return this.newService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateNewsDto
  ): Promise<any> {
    return this.newService.updateNews(id, dto);
  }

  @Get()
  @Public()
  async getAll(): Promise<News[]> {
    return this.newService.get();
  }
}
