import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from './schemas/profiles.schema';
import { CreateProfileDto } from './dto/create-profile.dto';


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

  // Tìm profile theo userId
  async findByUserId(userId: string | Types.ObjectId): Promise<Profile | null> {
    return this.profileModel.findOne({ userId }).exec();
  }
}
