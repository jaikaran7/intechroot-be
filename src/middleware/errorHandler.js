import { AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // Log all non-operational errors
  if (!err.isOperational) {
    console.error('[error]', err);
  }

  // Prisma known errors
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Record not found' },
    });
  }
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `A record with this ${field} already exists` },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    },
  });
}
