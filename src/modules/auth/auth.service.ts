import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ProfilesService } from '../profiles/profiles.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { SignInDto } from './dto/signin.dto';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
   constructor(
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    // Kiểm tra user đã tồn tại
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash mật khẩu
    const passwordHash = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = await this.usersService.create({ email, passwordHash });

    // Tạo profile cho user
    await this.profilesService.create({
      userId: user._id as Types.ObjectId,
      name: registerDto.username,
    });

    return { message: 'User registered successfully', userId: user._id };
  }

  async signIn(email: string, password: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user._id, email: user.email, role: user.role };
    const jti = uuidv4(); // tạo JWT ID
    const token = await this.jwtService.signAsync(payload, { jwtid: jti });

    return {
      access_token: token,
    };
  }
}
