import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Posts, PostSchema } from './schemas/posts.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';
import { Comment, CommentSchema } from '../comments/schemas/comments.schema';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Posts.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    UploadModule,
  ],
  providers: [PostsService],
  controllers: [PostsController]
})
export class PostsModule { }
