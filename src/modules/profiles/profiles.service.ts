import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from './schemas/profiles.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../users/schemas/user.schema';
import { Posts } from '../posts/schemas/posts.schema';
import { Comment } from '../comments/schemas/comments.schema';


@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private profileModel: Model<Profile>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Posts.name) private postModel: Model<Posts>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
  ) {}

  // Hàm tạo profile mới
  async create(createProfileDto: CreateProfileDto): Promise<Profile> {
    createProfileDto.userId = new Types.ObjectId(createProfileDto.userId);
    const profile = new this.profileModel(createProfileDto);
    return profile.save();
  }

  //Hàm cập nhật profile
  async updateProfile(userId:string, updateProfileDto: UpdateProfileDto){
    const id = new Types.ObjectId(userId);
    const updated = await this.profileModel.findOneAndUpdate(
      {userId: id},
      { $set: updateProfileDto },
      {new: true}
    ).exec();

    if (!updated){
      throw new NotFoundException("User not found");
    }
    return updated;
  }


  async getActiveMembers(limit: number = 5): Promise<any[]> {
    const activeProfiles = await this.postModel.aggregate([
      { $match: { status: 1, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$profile_id',
          postCount: { $sum: 1 },
        },
      },
      { $sort: { postCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: '$profile' },
      {
        $project: {
          _id: '$profile._id',
          name: '$profile.name',
          image_url: '$profile.image_url',
          postCount: 1,
        },
      },
    ]);

    return activeProfiles;
  }

  async findByUserId(userId: string | Types.ObjectId): Promise<any> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    return this.profileModel
      .findOne({ userId: id })
      .populate({
        path: 'userId',
        model: User.name,
        select: 'email role status provider premium_date premium_expired_date',
      })
      .exec();
  }


}
