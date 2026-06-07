import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { GenerateLearningPathDto } from './dto/generate-learning-path.dto';
import { SubmitPlacementDto } from './dto/submit-placement.dto';
import { LearningPathService } from './learning-path.service';

@Controller('learning-path')
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get('placement/questions')
  getPlacementQuestions(
    @Query('count', new DefaultValuePipe(20), ParseIntPipe) count: number,
  ) {
    return this.learningPathService.getPlacementQuestions(count);
  }

  @Get('status')
  getStatus(@Req() req: any) {
    return this.learningPathService.getStatus(req.user.sub);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.learningPathService.getDashboard(req.user.sub);
  }

  @Get('jlpt-card-status')
  getJlptCardStatus(
    @Req() req: any,
    @Query('skill') skill: string,
    @Query('level') level: string,
    @Query('refIds') refIds: string,
  ) {
    return this.learningPathService.getJlptCardStatus(req.user.sub, {
      skill,
      level,
      refIds: refIds ? refIds.split(',') : [],
    });
  }

  @Patch('jlpt-card-status')
  updateJlptCardStatus(@Req() req: any, @Body() body: any) {
    return this.learningPathService.updateJlptCardStatus(req.user.sub, body);
  }

  @Patch('complete-item')
  completeItem(@Req() req: any, @Body() body: any) {
    return this.learningPathService.completeItem(req.user.sub, body);
  }

  @Post('resource-progress')
  recordResourceProgress(@Req() req: any, @Body() body: any) {
    return this.learningPathService.recordResourceProgress(
      req.user.sub,
      body?.skill,
      body,
    );
  }

  @Post('placement/submit')
  submitPlacement(@Body() dto: SubmitPlacementDto) {
    return this.learningPathService.submitPlacement(dto);
  }

  @Post('generate')
  generate(@Req() req: any, @Body() dto: GenerateLearningPathDto) {
    return this.learningPathService.generateLearningPath(req.user.sub, dto);
  }
}
