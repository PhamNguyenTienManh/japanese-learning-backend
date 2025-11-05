import { Module } from '@nestjs/common';
import { PostCategoriesService } from './post_categories.service';
import { PostCategoriesController } from './post_categories.controller';

@Module({
  providers: [PostCategoriesService],
  controllers: [PostCategoriesController]
})
export class PostCategoriesModule {}
