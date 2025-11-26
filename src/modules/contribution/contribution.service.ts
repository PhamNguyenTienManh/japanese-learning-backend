import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contribution, ContributionDocument } from "./schemas/contribution.schema";
import { CreateContributionDto } from "./dto/create_contribution";
import { Types } from "mongoose";
import { User } from "../users/schemas/user.schema";
import { Profile } from "../profiles/schemas/profiles.schema";
import { Type } from "class-transformer";


@Injectable()
export class ContributionService {
  constructor(
    @InjectModel(Contribution.name)
    private readonly contributionModel: Model<ContributionDocument>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>,
  ) { }

  async create(userId: string, dto: CreateContributionDto) {
    const objectId = new Types.ObjectId(userId)
    const profileId = await this.profileModel.findOne({ userId: objectId }).select("_id")
    if (!profileId) {
      throw new Error("Profile not found")
    }
    const payload = {
      ...dto,
      profileId: profileId?._id
    };

    return await this.contributionModel.create(payload);
  }

  async findByKanji(kanjiId: string) {
    return await this.contributionModel
      .find({ kanjiId: kanjiId })
      .populate({
        path: "profileId",
        select: "name",
      })
      .exec();
  }

  async findByUser(userId: string) {
    return await this.contributionModel
      .find({ userId })
      .populate("kanjiId")
      .exec();
  }
}
