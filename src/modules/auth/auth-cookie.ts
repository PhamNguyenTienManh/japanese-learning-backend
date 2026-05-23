import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'access_token';

const AUTH_COOKIE_MAX_AGE = 2 * 60 * 60 * 1000;

function getSameSite(): CookieOptions['sameSite'] {
  const value = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  if (value === 'strict' || value === 'lax' || value === 'none') {
    return value;
  }
  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}

export function getAuthCookieOptions(): CookieOptions {
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
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(response: Response) {
  const { maxAge, ...options } = getAuthCookieOptions();
  response.clearCookie(AUTH_COOKIE_NAME, options);
}

export function extractAuthToken(request: Request): string | undefined {
  const cookieToken = extractTokenFromCookie(request);
  if (cookieToken) return cookieToken;

  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

function extractTokenFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
}
