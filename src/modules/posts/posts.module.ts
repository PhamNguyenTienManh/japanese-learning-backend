import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Posts, PostSchema } from './schemas/posts.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name: Posts.name, schema: PostSchema}
    ])
  ],
  providers: [PostsService],
  controllers: [PostsController]
})
export class PostsModule {}
