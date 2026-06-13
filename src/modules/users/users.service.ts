import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './schemas/user.schema';
import { Profile } from '../profiles/schemas/profiles.schema';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/update-user.dto';

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

  private toProfilePayload(data: Partial<AdminCreateUserDto | AdminUpdateUserDto>) {
    const payload: Record<string, any> = {};
    const fields = [
      'name',
      'image_url',
      'address',
      'phone',
      'birthday',
      'sex',
      'job',
      'introduction',
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        payload[field] = data[field] === '' ? undefined : data[field];
      }
    });

    return payload;
  }

  private async attachProfile(user: User): Promise<any> {
    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();

    return {
      ...user.toObject(),
      profile: profile ? {
        name: profile.name,
        image_url: profile.image_url,
        sex: profile.sex,
        address: profile.address,
        phone: profile.phone,
        birthday: profile.birthday,
        job: profile.job,
        introduction: profile.introduction,
      } : null
    };
  }

  async createInternalAccount(dto: AdminCreateUserDto): Promise<any> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({
      email: dto.email,
      passwordHash,
      role: dto.role || 'student',
      status: dto.status || 'active',
      provider: 'local',
    });

    try {
      const savedUser = await user.save();
      await this.profileModel.create({
        userId: savedUser._id,
        name: dto.name,
        ...this.toProfilePayload(dto),
      });

      return this.attachProfile(savedUser);
    } catch (error) {
      if (user._id) {
        await this.userModel.findByIdAndDelete(user._id).exec();
      }
      throw error;
    }
  }

  async findAll(): Promise<any[]> {
    const users = await this.userModel.find().exec();
    
    // Populate profile cho mỗi user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        return this.attachProfile(user);
      })
    );
    
    return usersWithProfiles;
  }

  async findOne(id: string): Promise<any | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.attachProfile(user) : null;
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
    
    return this.attachProfile(user);
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
    
    return this.attachProfile(user);
  }

  async updateAdminUser(id: string, dto: AdminUpdateUserDto): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email);
      if (existingUser && String(existingUser._id) !== String(user._id)) {
        throw new ConflictException('Email đã tồn tại');
      }
      user.email = dto.email;
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      user.provider = 'local';
    }

    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;

    const savedUser = await user.save();
    const profilePayload = this.toProfilePayload(dto);

    if (Object.keys(profilePayload).length > 0) {
      const insertDefaults: Record<string, any> = {
        userId: savedUser._id,
      };

      if (profilePayload.name === undefined) {
        insertDefaults.name = user.email;
      }

      await this.profileModel
        .findOneAndUpdate(
          { userId: savedUser._id },
          {
            $set: profilePayload,
            $setOnInsert: insertDefaults,
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        .exec();
    }

    return this.attachProfile(savedUser);
  }

  async delete(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}
