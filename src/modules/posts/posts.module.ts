import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Posts, PostSchema } from './schemas/posts.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Posts.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
    ])
  ],
  providers: [PostsService],
  controllers: [PostsController]
})
export class PostsModule { }
