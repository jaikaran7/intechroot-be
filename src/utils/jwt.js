import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';

export function signAccessToken(payload, options = {}) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn:
      options.expiresIn ?? process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}
