import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler.js';
import { handleMulterError } from './middleware/upload.js';

import authRoutes from './modules/auth/auth.routes.js';
import jobRoutes from './modules/jobs/jobs.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import employeeRoutes from './modules/employees/employees.routes.js';
import timesheetRoutes from './modules/timesheets/timesheets.routes.js';
import documentRoutes from './modules/documents/documents.routes.js';
import payrollRoutes from './modules/payroll/payroll.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import adminPanelRoutes from './modules/admin-panel/admin-panel.routes.js';

const app = express();

// ─── Security ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      // Browsers may apply this CSP to API JSON responses. Allow typical HTTPS
      // fetches (frontend → API) while keeping a tight default policy.
      connectSrc: [
        "'self'",
        'https:',
        'wss:',
        'data:',
        process.env.SUPABASE_URL || '',
      ].filter(Boolean),
    },
  },
  crossOriginEmbedderPolicy: false,
}));
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

// ─── Global rate limit ─────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 800,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  skip: (req) =>
    req.path === '/api/v1/auth/refresh-token' ||
    req.path === '/health' ||
    // Public job application: rely on duplicate checks, not throttling legitimate applicants
    (req.method === 'POST' && req.path === '/api/v1/applications'),
}));

// ─── Parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'InTech Root API is running', timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/timesheets', timesheetRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin-panel', adminPanelRoutes);

// ─── 404 ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// ─── Error handlers ────────────────────────────────────────
app.use(handleMulterError);
app.use(errorHandler);

export default app;
