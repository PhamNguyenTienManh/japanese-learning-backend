import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

export const AUTH_COOKIE_MAX_AGE = 2 * 60 * 60 * 1000;
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getSameSite(): CookieOptions['sameSite'] {
  const value = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  if (value === 'strict' || value === 'lax' || value === 'none') {
    return value;
  }
  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}

export function getAuthCookieOptions(): CookieOptions {
  return getCookieOptions(AUTH_COOKIE_MAX_AGE);
}

export function getRefreshCookieOptions(): CookieOptions {
  return getCookieOptions(REFRESH_COOKIE_MAX_AGE);
}

function getCookieOptions(maxAge: number): CookieOptions {
  const sameSite = getSameSite();
  const secure =
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    sameSite === 'none' ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge,
  };
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(response: Response) {
  const { maxAge, ...options } = getAuthCookieOptions();
  response.clearCookie(AUTH_COOKIE_NAME, options);
}

export function setRefreshCookie(response: Response, token: string) {
  response.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(response: Response) {
  const { maxAge, ...options } = getRefreshCookieOptions();
  response.clearCookie(REFRESH_COOKIE_NAME, options);
}

export function extractAuthToken(request: Request): string | undefined {
  const cookieToken = extractTokenFromCookie(request, AUTH_COOKIE_NAME);
  if (cookieToken) return cookieToken;

  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

export function extractRefreshToken(request: Request): string | undefined {
  return extractTokenFromCookie(request, REFRESH_COOKIE_NAME);
}

function extractTokenFromCookie(
  request: Request,
  cookieName: string,
): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === cookieName) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
}
