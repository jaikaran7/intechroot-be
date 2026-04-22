/**
 * When Resend is not configured, applicants sign in with email only after admin approval.
 * Set RESEND_API_KEY and keep APPLICANT_PASSWORDLESS_LOGIN unset (or "false") to require
 * the temporary password emailed on approval.
 */
export function applicantUsesPasswordLogin() {
  return Boolean(process.env.RESEND_API_KEY) && process.env.APPLICANT_PASSWORDLESS_LOGIN !== 'true';
}

/**
 * When true, applicant portal does not verify the password hash (any non-empty dummy works;
 * empty password is also allowed). Turn off for production with emailed passwords.
 * - APPLICANT_ACCEPT_ANY_PASSWORD=false → always verify bcrypt when a portal User exists.
 * - APPLICANT_ACCEPT_ANY_PASSWORD=true → never verify (testing only).
 * - Unset: defaults to true when RESEND_API_KEY is missing, false when Resend is configured.
 */
export function applicantAcceptsAnyPassword() {
  if (process.env.APPLICANT_ACCEPT_ANY_PASSWORD === 'false') return false;
  if (process.env.APPLICANT_ACCEPT_ANY_PASSWORD === 'true') return true;
  return !Boolean(process.env.RESEND_API_KEY);
}
