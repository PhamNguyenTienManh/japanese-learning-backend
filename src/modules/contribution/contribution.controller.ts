import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ContributionService } from "./contribution.service";
import { CreateContributionDto } from "./dto/create_contribution";
import { Public } from "../auth/public.decorator";

@Controller("contributions")
export class ContributionController {
  constructor(private readonly service: ContributionService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateContributionDto) {
    const userId = req.user.sub;
    return this.service.create(userId, dto);
  }

  @Get("kanji/:kanjiId")
  @Public()
  getByKanji(@Param("kanjiId") kanjiId: string) {
    return this.service.findByKanji(kanjiId);
  }

  @Get("user/:userId")
  getByUser(@Param("userId") userId: string) {
    return this.service.findByUser(userId);
  }
}
