import { Module } from '@nestjs/common';
import { PostCategoriesService } from './post_categories.service';
import { PostCategoriesController } from './post_categories.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { PostCategory, PostCategorySchema } from './schemas/post_categories.shema';

@Module({
  imports:[
    MongooseModule.forFeature([
      {name: PostCategory.name, schema: PostCategorySchema}
    ]),
  ],
  providers: [PostCategoriesService],
  controllers: [PostCategoriesController]
})
export class PostCategoriesModule {}
