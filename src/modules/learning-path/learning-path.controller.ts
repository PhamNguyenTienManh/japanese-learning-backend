import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { ApplyReviewDto } from './dto/apply-review.dto';
import { GenerateLearningPathDto } from './dto/generate-learning-path.dto';
import { SubmitPlacementDto } from './dto/submit-placement.dto';
import { LearningPathService } from './learning-path.service';

@Controller('learning-path')
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Roles('admin')
  @Get('admin/paths')
  adminListLearningPaths(@Query() query: any) {
    return this.learningPathService.adminListLearningPaths(query);
  }

  @Roles('admin')
  @Get('admin/paths/:id')
  adminGetLearningPath(@Param('id') id: string) {
    return this.learningPathService.adminGetLearningPath(id);
  }

  @Roles('admin')
  @Patch('admin/paths/:id')
  adminUpdateLearningPath(@Param('id') id: string, @Body() body: any) {
    return this.learningPathService.adminUpdateLearningPath(id, body);
  }

  @Roles('admin')
  @Post('admin/paths/:id/review')
  adminRunReview(@Param('id') id: string) {
    return this.learningPathService.adminRunReview(id);
  }

  @Roles('admin')
  @Patch('admin/paths/:id/apply-review')
  adminApplyReview(@Param('id') id: string, @Body() body: any) {
    return this.learningPathService.adminApplyReview(id, body);
  }

  @Roles('admin')
  @Patch('admin/paths/:id/dismiss-review')
  adminDismissReview(@Param('id') id: string) {
    return this.learningPathService.adminDismissReview(id);
  }

  @Roles('admin')
  @Get('admin/placement-questions')
  adminListPlacementQuestions(@Query() query: any) {
    return this.learningPathService.adminListPlacementQuestions(query);
  }

  @Roles('admin')
  @Get('admin/placement-questions/:id')
  adminGetPlacementQuestion(@Param('id') id: string) {
    return this.learningPathService.adminGetPlacementQuestion(id);
  }

  @Roles('admin')
  @Post('admin/placement-questions')
  adminCreatePlacementQuestion(@Body() body: any) {
    return this.learningPathService.adminCreatePlacementQuestion(body);
  }

  @Roles('admin')
  @Patch('admin/placement-questions/:id')
  adminUpdatePlacementQuestion(@Param('id') id: string, @Body() body: any) {
    return this.learningPathService.adminUpdatePlacementQuestion(id, body);
  }

  @Roles('admin')
  @Delete('admin/placement-questions/:id')
  adminDeletePlacementQuestion(@Param('id') id: string) {
    return this.learningPathService.adminDeletePlacementQuestion(id);
  }

  @Roles('admin')
  @Get('admin/placement-config')
  adminGetPlacementTestConfig() {
    return this.learningPathService.adminGetPlacementTestConfig();
  }

  @Roles('admin')
  @Patch('admin/placement-config')
  adminUpdatePlacementTestConfig(@Body() body: any) {
    return this.learningPathService.adminUpdatePlacementTestConfig(body);
  }

  @Roles('admin')
  @Get('admin/progress')
  adminGetProgressOverview(@Query() query: any) {
    return this.learningPathService.adminGetProgressOverview(query);
  }

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

  @Post('review')
  reviewLearningPath(@Req() req: any) {
    return this.learningPathService.reviewLearningPath(req.user.sub);
  }

  @Patch('apply-review')
  applyReview(@Req() req: any, @Body() dto: ApplyReviewDto) {
    return this.learningPathService.applyReview(req.user.sub, dto);
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
