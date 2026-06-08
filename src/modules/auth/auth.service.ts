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
import { ChangePasswordDto } from "./dto/change-password.dto";
import * as nodemailer from "nodemailer";
import { VerifyRegisterOtpDto } from "./dto/verify-register-otp.dto";
import { User } from "../users/schemas/user.schema";
import { InjectModel } from "@nestjs/mongoose";
import { Profile } from "../profiles/schemas/profiles.schema";
import { AUTH_COOKIE_MAX_AGE, REFRESH_COOKIE_MAX_AGE } from "./auth-cookie";
import {
  accessTokenExpiresIn,
  getRefreshTokenSecret,
  jwtConstants,
  refreshTokenExpiresIn,
} from "./constants";

type AuthTokenPair = {
  access_token: string;
  refresh_token: string;
};

type AuthJwtPayload = {
  sub: string;
  email: string;
  role: string;
  token_type?: "refresh";
  jti?: string;
  exp?: number;
};

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

  private async generateToken(user: any): Promise<AuthTokenPair> {
    const payload = this.createAuthPayload(user);
    return this.signTokenPair(payload);
  }

  private createAuthPayload(user: any): Omit<AuthJwtPayload, "token_type"> {
    return {
      sub: String(user._id ?? user.id),
      email: user.email,
      role: user.role,
    };
  }

  private async signTokenPair(
    payload: Omit<AuthJwtPayload, "token_type">,
  ): Promise<AuthTokenPair> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtConstants.secret,
        expiresIn: accessTokenExpiresIn,
        jwtid: accessJti,
      }),
      this.jwtService.signAsync(
        { ...payload, token_type: "refresh" },
        {
          secret: getRefreshTokenSecret(),
          expiresIn: refreshTokenExpiresIn,
          jwtid: refreshJti,
        },
      ),
    ]);

    await this.cacheManager.set(
      this.getRefreshTokenCacheKey(refreshJti),
      payload.sub,
      REFRESH_COOKIE_MAX_AGE,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private getRefreshTokenCacheKey(jti: string) {
    return `refresh_${jti}`;
  }

  async getCurrentSession(payload: any) {
    const user = await this.userModel
      .findById(payload?.sub)
      .select('email role premium_date premium_expired_date')
      .lean();

    if (!user) {
      return payload;
    }

    const now = new Date();
    const isPremium = !!(
      user.premium_expired_date && user.premium_expired_date > now
    );

    return {
      ...payload,
      email: user.email,
      role: user.role,
      isPremium,
      premium_date: user.premium_date || null,
      premium_expired_date: user.premium_expired_date || null,
    };
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
  ): Promise<AuthTokenPair> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Không tìm thấy tài khoản này!");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException("Sai mật khẩu!");
    }
    if(user.status === "banned") throw new UnauthorizedException("Your account is banned")

    return this.generateToken(user);
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    if (user.provider === "google" || !user.passwordHash) {
      throw new BadRequestException(
        "Tài khoản của bạn đang liên kết qua Google, không thể đổi mật khẩu tại đây",
      );
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException("Mật khẩu mới không được trùng mật khẩu hiện tại");
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: "Đổi mật khẩu thành công" };
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

  async refreshSession(refreshToken?: string): Promise<AuthTokenPair> {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token không hợp lệ");
    }

    let payload: AuthJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(
        refreshToken,
        {
          secret: getRefreshTokenSecret(),
        },
      );
    } catch {
      throw new UnauthorizedException("Refresh token không hợp lệ");
    }

    if (payload.token_type !== "refresh" || !payload.sub || !payload.jti) {
      throw new UnauthorizedException("Refresh token không hợp lệ");
    }

    const refreshKey = this.getRefreshTokenCacheKey(payload.jti);
    const storedUserId = await this.cacheManager.get<string>(refreshKey);
    if (storedUserId !== String(payload.sub)) {
      throw new UnauthorizedException("Refresh token đã hết hạn");
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select("email role status")
      .exec();

    if (!user) {
      await this.cacheManager.del(refreshKey);
      throw new UnauthorizedException("Không tìm thấy tài khoản này!");
    }

    if (user.status === "banned") {
      await this.cacheManager.del(refreshKey);
      throw new UnauthorizedException("Your account is banned");
    }

    await this.cacheManager.del(refreshKey);
    return this.generateToken(user);
  }

  async logout(accessToken?: string, refreshToken?: string) {
    await Promise.all([
      this.revokeAccessToken(accessToken),
      this.revokeRefreshToken(refreshToken),
    ]);

    return { message: "Đăng xuất thành công" };
  }

  private async revokeAccessToken(token?: string) {
    if (!token) return;

    const decoded = this.jwtService.decode(token) as AuthJwtPayload | null;
    if (!decoded?.jti || !decoded.exp) return;

    const expiresAt = decoded.exp * 1000;
    const remainingMs = Math.min(
      AUTH_COOKIE_MAX_AGE,
      Math.max(1, expiresAt - Date.now()),
    );

    if (expiresAt > Date.now()) {
      await this.cacheManager.set(`blacklist_${decoded.jti}`, true, remainingMs);
    }
  }

  private async revokeRefreshToken(token?: string) {
    if (!token) return;

    const decoded = this.jwtService.decode(token) as AuthJwtPayload | null;
    if (!decoded?.jti) return;

    await this.cacheManager.del(this.getRefreshTokenCacheKey(decoded.jti));
  }

  async getSession(payload: any) {
    const user = await this.userModel
      .findById(payload.sub)
      .select("premium_expired_date")
      .exec();
    const premiumExpiredDate = user?.premium_expired_date ?? null;
    const isPremium = premiumExpiredDate
      ? premiumExpiredDate.getTime() > Date.now()
      : false;

    return {
      ...payload,
      isPremium,
      premiumExpiredDate: premiumExpiredDate
        ? premiumExpiredDate.toISOString()
        : null,
    };
  }
}
