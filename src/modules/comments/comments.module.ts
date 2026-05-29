import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from './schemas/comments.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profiles.schema';
import { ModerationModule } from '../moderation/moderation.module';
import { UserActivitiesModule } from '../user_activities/user_activities.module';
import { Posts, PostSchema } from '../posts/schemas/posts.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        {name: Comment.name, schema: CommentSchema},
        {name: Profile.name, schema: ProfileSchema},
        {name: Posts.name, schema: PostSchema}
      ]),
      ModerationModule,
      UserActivitiesModule,
    ],
  providers: [CommentsService],
  controllers: [CommentsController]
})
export class CommentsModule {}
