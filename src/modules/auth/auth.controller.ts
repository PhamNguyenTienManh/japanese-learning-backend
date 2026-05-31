import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Get, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { RegisterDto } from './dto/register.dto';
import { SignInDto } from './dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgor-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  clearAuthCookie,
  clearRefreshCookie,
  extractAuthToken,
  extractRefreshToken,
  setAuthCookie,
  setRefreshCookie,
} from './auth-cookie';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-register')
  @Public()
  verifyRegister(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }
  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('login')
  async login(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = await this.authService.signIn(signInDto.email, signInDto.password);
    setAuthCookie(response, data.access_token);
    setRefreshCookie(response, data.refresh_token);
    return { message: 'Login successful' };
  }

  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = extractRefreshToken(req);
    const data = await this.authService.refreshSession(refreshToken);
    setAuthCookie(response, data.access_token);
    setRefreshCookie(response, data.refresh_token);
    return { message: 'Token refreshed' };
  }

  @Post('forgot-password')
  @Public()
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-otp')
  @Public()
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Public()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = extractAuthToken(req);
    const refreshToken = extractRefreshToken(req);
    const result = await this.authService.logout(token, refreshToken);
    clearAuthCookie(response);
    clearRefreshCookie(response);
    return result;
  }

  @Get('me')
  async me(@Req() req) {
    return this.authService.getCurrentSession(req.user);
  }

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuth() { }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const data = await this.authService.validateGoogleUser(req.user);
    setAuthCookie(res, data.access_token);
    setRefreshCookie(res, data.refresh_token);
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    return res.redirect(`${frontendUrl}/login?google=success`);
  }
}
