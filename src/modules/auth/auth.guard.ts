import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { JwtService } from "@nestjs/jwt";
import { jwtConstants } from "./constants";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { extractAuthToken } from "./auth-cookie";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();

    if (isPublic) {
      const token = extractAuthToken(request);
      if (!token) {
        return true;
      }

      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: jwtConstants.secret,
        });
        if (payload.jti) {
          const isBlacklisted = await this.cacheManager.get(
            `blacklist_${payload.jti}`,
          );
          if (!isBlacklisted) {
            request["user"] = payload;
          }
        } else {
          request["user"] = payload;
        }
      } catch {
        return true;
      }
      return true;
    }

    const token = extractAuthToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      if (payload.jti) {
        const isBlacklisted = await this.cacheManager.get(
          `blacklist_${payload.jti}`,
        );
        if (isBlacklisted) {
          throw new UnauthorizedException("Token has been revoked");
        }
      }
      request["user"] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }
}
