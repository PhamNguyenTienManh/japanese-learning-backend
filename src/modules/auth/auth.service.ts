import { Injectable, UnauthorizedException, ConflictException, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ProfilesService } from '../profiles/profiles.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { SignInDto } from './dto/signin.dto';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForgotPasswordDto } from './dto/forgor-password.dto';
import type { Cache } from 'cache-manager';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as nodemailer from 'nodemailer';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,

  ) { }

  // async register(registerDto: RegisterDto) {
  //   const { email, password } = registerDto;

  //   // Kiểm tra user đã tồn tại
  //   const existingUser = await this.usersService.findByEmail(email);
  //   if (existingUser) {
  //     throw new ConflictException('Email already exists');
  //   }

  //   // Hash mật khẩu
  //   const passwordHash = await bcrypt.hash(password, 10);

  //   // Tạo user mới
  //   const user = await this.usersService.create({ email, passwordHash });

  //   // Tạo profile cho user
  //   await this.profilesService.create({
  //     userId: user._id as Types.ObjectId,
  //     name: registerDto.username,
  //   });

  //   return { message: 'User registered successfully', userId: user._id };
  // }


  async register(dto: RegisterDto) {
    const { email, username, password } = dto;

    // Check email tồn tại chưa
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Tạo OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Lưu thông tin đăng ký tạm vào Redis
    await this.cacheManager.set(
      `register_${email}`,
      { email, username, password },
      5 * 60 * 1000
    );

    // Lưu OTP
    await this.cacheManager.set(
      `otp_register_${email}`,
      otp,
      5 * 60 * 1000
    );

    await this.sendOtpEmail(email, otp);

    return { message: 'OTP sent to your email. Please verify to complete registration.' };
  }

  async verifyRegisterOtp(dto: VerifyRegisterOtpDto) {
    const { email, otp } = dto;

    const savedOtp = await this.cacheManager.get<string>(`otp_register_${email}`);

    if (!savedOtp) throw new BadRequestException('OTP expired');
    if (savedOtp !== otp) throw new BadRequestException('Invalid OTP');

    // Lấy dữ liệu đăng ký tạm
    const tempData = await this.cacheManager.get<any>(`register_${email}`);
    if (!tempData) throw new BadRequestException('Registration data expired');

    const { username, password } = tempData;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Lưu user vào DB
    const user = await this.usersService.create({ email, passwordHash });

    await this.profilesService.create({
      userId: user._id as Types.ObjectId,
      name: username,
    });

    // Xóa Redis
    await this.cacheManager.del(`register_${email}`);
    await this.cacheManager.del(`otp_register_${email}`);

    return { message: 'Registration completed successfully', userId: user._id };
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
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email)
    if (!user) throw new NotFoundException('Email not found');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.cacheManager.set(`otp_${dto.email}`, otp, 5 * 60 * 1000);
    await this.sendOtpEmail(dto.email, otp);
    return { message: 'OTP sent to your email' };

  }

  async verifyOtp(dto: VerifyOtpDto) {
    const savedOtp = await this.cacheManager.get<string>(`otp_${dto.email}`)

    if (!savedOtp) throw new BadRequestException('OTP expired')
    if (savedOtp !== dto.otp) throw new BadRequestException('Invalid OTP');
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');
    const newHash = await bcrypt.hash(dto.password, 10)
    user.passwordHash = newHash;
    await user.save()

    await this.cacheManager.del(`otp_${dto.email}`);
    return { message: 'Password reset successfully' };
  }

  private async sendOtpEmail(to: string, otp: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      }
    })
    await transporter.sendMail({
      from: 'JAVI <noreply@javi.com>',
      to,
      subject: 'Your OTP Code',
      html: `
        <p>Your OTP is: <b>${otp}</b></p>
        <p>This code expires in <b>5 minutes</b>.</p>
      `,
    })
  }


  async logout(token: string) {
  try {
    const decoded = this.jwtService.decode(token) as any;
    if (!decoded || !decoded.jti) {
      throw new BadRequestException('Invalid token');
    }

    const jti = decoded.jti;

    // Lấy thời gian còn lại của token để set TTL cho blacklist
    const expiresAt = decoded.exp * 1000;
    const now = Date.now();
    const ttl = Math.max(1, Math.floor((expiresAt - now) / 1000)); // giây

    // Đưa token vào blacklist
    await this.cacheManager.set(
      `blacklist_${jti}`,
      true,
      ttl
    );

    return { message: 'Logged out successfully' };
  } catch (err) {
    throw new BadRequestException('Logout failed');
  }
}


}
