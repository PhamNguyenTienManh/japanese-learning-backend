import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from './schemas/profiles.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';


@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(Profile.name) private profileModel: Model<Profile>,
  ) {}

  // Hàm tạo profile mới
  async create(createProfileDto: CreateProfileDto): Promise<Profile> {
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


  async findByUserId(userId: string | Types.ObjectId): Promise<Profile | null> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.profileModel.findOne({ userId: id }).exec();
  }

}
