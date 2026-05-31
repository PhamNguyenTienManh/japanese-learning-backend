export const jwtConstants = {
  secret: 'secretKey',
};

export const accessTokenExpiresIn = '2h';
export const refreshTokenExpiresIn = '7d';

export function getRefreshTokenSecret() {
  return process.env.JWT_REFRESH_SECRET || `${jwtConstants.secret}-refresh`;
}
