const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('[env] Copy .env.example to .env and fill in all values.');
    process.exit(1);
  }
  console.log('[env] All required environment variables are set.');
}
