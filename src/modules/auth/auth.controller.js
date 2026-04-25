import * as AuthService from './auth.service.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function register(req, res, next) {
  try {
    const user = await AuthService.register(req.body, req.user);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user, employee } = await AuthService.login(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ success: true, data: { accessToken, user, ...(employee && { employee }) } });
  } catch (err) { next(err); }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await AuthService.logout(refreshToken);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
}

export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return next(new (await import('../../utils/errors.js')).UnauthorizedError('No refresh token'));
    const { accessToken } = await AuthService.refreshAccessToken(token);
    res.json({ success: true, data: { accessToken } });
  } catch (err) { next(err); }
}

export async function applicantLogin(req, res, next) {
  try {
    const result = await AuthService.applicantLogin(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function employeeLogin(req, res, next) {
  try {
    const { accessToken, refreshToken, user, employee } = await AuthService.verifyEmployee(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ success: true, data: { accessToken, user, employee } });
  } catch (err) { next(err); }
}
