import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { Profile, ProfileSchema } from './schemas/profiles.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Posts, PostSchema } from '../posts/schemas/posts.schema';
import { Comment, CommentSchema } from '../comments/schemas/comments.schema';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Profile.name, schema: ProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: Posts.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    UploadModule,
  ],
  providers: [ProfilesService],
  controllers: [ProfilesController],
  exports: [ProfilesService], 
})
export class ProfilesModule {}
