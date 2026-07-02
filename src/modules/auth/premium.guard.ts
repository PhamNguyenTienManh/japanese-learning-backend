import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException("Bạn cần đăng nhập để sử dụng tính năng này");
    }

    if (user.role === "admin") {
      return true;
    }

    if (user.isPremium) {
      return true;
    }

    if (user.premiumExpiredDate) {
      const expiredDate = new Date(user.premiumExpiredDate);
      if (expiredDate.getTime() > Date.now()) {
        return true;
      }
    }

    throw new ForbiddenException("Tính năng này chỉ dành cho tài khoản Pro");
  }
}
