import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { ProfilesService } from "../profiles/profiles.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { SignInDto } from "./dto/signin.dto";
import { Model, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ForgotPasswordDto } from "./dto/forgor-password.dto";
import type { Cache } from "cache-manager";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import * as nodemailer from "nodemailer";
import { VerifyRegisterOtpDto } from "./dto/verify-register-otp.dto";
import { User } from "../users/schemas/user.schema";
import { InjectModel } from "@nestjs/mongoose";
import { Profile } from "../profiles/schemas/profiles.schema";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Profile.name) private readonly profileModel: Model<Profile>
  ) {}

  async findByUserId(userId: Types.ObjectId) {
    return this.profileModel.findOne({ userId });
  }

  async validateGoogleUser(googleUser) {
    const { email, firstName, lastName, picture, google_id } = googleUser;

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      // Tạo user mới
      user = (await this.usersService.create({
        email,
        provider: "google",
        google_id,
        passwordHash: "",
      })) as any;
    }

    let profile = await this.profilesService.findByUserId(user?.id);
    if (!profile) {
      profile = await this.profilesService.create({
        userId: user?.id,
        name: firstName || email.split("@")[0],
      });
    }

    return this.generateToken(user);
  }

  private async generateToken(user: any): Promise<{ access_token: string }> {
    const payload = { sub: user._id, email: user.email, role: user.role };
    const jti = uuidv4();
    const token = await this.jwtService.signAsync(payload, { jwtid: jti });
    return { access_token: token };
  }

  async findByEmail(mail: string) {
    return this.userModel.findOne({ email: mail });
  }

  async create(data) {
    const user = new this.userModel(data);
    return user.save();
  }

  async register(dto: RegisterDto) {
    const { email, username, password } = dto;

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException("Email đã tồn tại");
    }

    // Tạo OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu thông tin đăng ký tạm thời vào Redis
    await this.cacheManager.set(
      `register_${email}`,
      { email, username, password },
      5 * 60 * 1000
    );

    // Lưu OTP
    await this.cacheManager.set(`otp_register_${email}`, otp, 5 * 60 * 1000);

    await this.sendOtpEmail(email, otp);

    return {
      message:
        "OTP đã được gửi đến email của bạn. Vui lòng xác thực để hoàn tất đăng ký.",
    };
  }

  async verifyRegisterOtp(dto: VerifyRegisterOtpDto) {
    const { email, otp } = dto;

    const savedOtp = await this.cacheManager.get<string>(
      `otp_register_${email}`
    );

    if (!savedOtp) throw new BadRequestException("OTP đã hết hạn");
    if (savedOtp !== otp) throw new BadRequestException("OTP không hợp lệ");

    // Lấy dữ liệu đăng ký tạm
    const tempData = await this.cacheManager.get<any>(`register_${email}`);
    if (!tempData) throw new BadRequestException("Dữ liệu đăng ký đã hết hạn");

    const { username, password } = tempData;

    // Hash mật khẩu
    const passwordHash = await bcrypt.hash(password, 10);

    // Lưu user vào DB
    const user = await this.usersService.create({ email, passwordHash });

    await this.profilesService.create({
      userId: user._id as Types.ObjectId,
      name: username,
    });

    // Xóa dữ liệu Redis
    await this.cacheManager.del(`register_${email}`);
    await this.cacheManager.del(`otp_register_${email}`);

    return { message: "Đăng ký thành công", userId: user._id };
  }

  async signIn(
    email: string,
    password: string
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Không tìm thấy tài khoản này!");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException("Sai mật khẩu!");
    }
    if(user.status === "banned") throw new UnauthorizedException("Your account is banned")

    const payload = { sub: user._id, email: user.email, role: user.role };
    const jti = uuidv4();
    const token = await this.jwtService.signAsync(payload, { jwtid: jti });

    return {
      access_token: token,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException("Không tìm thấy email này");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.cacheManager.set(`otp_${dto.email}`, otp, 5 * 60 * 1000);

    await this.sendOtpEmail(dto.email, otp);
    return { message: "OTP đã được gửi đến email của bạn" };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const savedOtp = await this.cacheManager.get<string>(`otp_${dto.email}`);

    if (!savedOtp) throw new BadRequestException("OTP đã hết hạn");
    if (savedOtp !== dto.otp) throw new BadRequestException("OTP không hợp lệ");

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException("Không tìm thấy người dùng");

    const newHash = await bcrypt.hash(dto.password, 10);
    user.passwordHash = newHash;
    await user.save();

    await this.cacheManager.del(`otp_${dto.email}`);
    return { message: "Đặt lại mật khẩu thành công" };
  }

  private async sendOtpEmail(to: string, otp: string) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: "JAVI <noreply@javi.com>",
      to,
      subject: "Mã OTP của bạn",
      html: `
        <p>Mã OTP của bạn là: <b>${otp}</b></p>
        <p>Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
      `,
    });
  }

  async logout(token: string) {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (!decoded || !decoded.jti) {
        throw new BadRequestException("Token không hợp lệ");
      }

      const jti = decoded.jti;

      // Lấy thời gian còn lại của token để set TTL cho blacklist
      const expiresAt = decoded.exp * 1000;
      const now = Date.now();
      const ttl = Math.max(1, Math.floor((expiresAt - now) / 1000)); // giây

      // Đưa token vào blacklist
      await this.cacheManager.set(`blacklist_${jti}`, true, ttl);

      return { message: "Đăng xuất thành công" };
    } catch (err) {
      throw new BadRequestException("Đăng xuất thất bại");
    }
  }
}
