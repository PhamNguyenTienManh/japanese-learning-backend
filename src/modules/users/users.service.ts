import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { Profile } from '../profiles/schemas/profiles.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Profile.name) private profileModel: Model<Profile>
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const newUser = new this.userModel(data);
    return newUser.save();
  }

  async findAll(): Promise<any[]> {
    const users = await this.userModel.find().exec();
    
    // Populate profile cho mỗi user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const profile = await this.profileModel
          .findOne({ userId: user._id })
          .exec();
        
        return {
          ...user.toObject(),
          profile: profile ? {
            name: profile.name,
            image_url: profile.image_url,
            sex: profile.sex
          } : null
        };
      })
    );
    
    return usersWithProfiles;
  }

  async findOne(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async updateStatus(id: string, status: 'active' | 'banned'): Promise<any> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { status },
        { new: true }
      )
      .exec();
    
    if (!user) return null;
    
    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();
    
    return {
      ...user.toObject(),
      profile: profile ? {
        name: profile.name,
        image_url: profile.image_url,
        sex: profile.sex
      } : null
    };
  }

  async updateRole(id: string, role: 'student' | 'admin'): Promise<any> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { role },
        { new: true }
      )
      .exec();
    
    if (!user) return null;
    
    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();
    
    return {
      ...user.toObject(),
      profile: profile ? {
        name: profile.name,
        image_url: profile.image_url,
        sex: profile.sex
      } : null
    };
  }

  async delete(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}