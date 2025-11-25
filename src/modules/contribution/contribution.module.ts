import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Contribution, ContributionSchema } from "./schemas/contribution.schema";
import { ContributionService } from "./contribution.service";
import { ContributionController } from "./contribution.controller";
import { Profile, ProfileSchema } from "../profiles/schemas/profiles.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contribution.name, schema: ContributionSchema },
      { name: Profile.name, schema: ProfileSchema},
    ]),
  ],
  controllers: [ContributionController],
  providers: [ContributionService],
  exports: [ContributionService],
})
export class ContributionModule {}
