import { Resend } from 'resend';

const FROM = process.env.FROM_EMAIL || 'noreply@intechroot.com';
const COMPANY_NAME = process.env.COMPANY_NAME || 'InTech Root';
const COMPANY_LOGO_URL = process.env.COMPANY_LOGO_URL || '';
const BRAND_COLOR = process.env.BRAND_COLOR || '#4F46E5';
const HR_EMAIL = process.env.HR_EMAIL || '';
let resend;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail({ to, subject, html }) {
  const client = getResendClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return;
  }
  try {
    await client.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Failed to send email:', err.message);
  }
}

function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeHref(input) {
  const s = String(input ?? '').trim();
  if (!s) return '#';
  return s.replace(/"/g, '');
}

function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Public frontend base URL for links inside emails (must be absolute, no trailing slash).
 * Set `BASE_URL` in production (e.g. https://intechroot.com). For local email testing use http://localhost:5173.
 */
export function getBaseUrl() {
  const raw =
    process.env.BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    'https://intechroot.com';
  return String(raw).trim().replace(/\/$/, '');
}

function button(link, label) {
  const href = safeHref(link);
  const text = escapeHtml(label || 'Open');
  return `
    <div style="margin:24px 0">
      <a
        href="${href}"
        style="
          display:inline-block;
          background:${BRAND_COLOR};
          color:#ffffff;
          text-decoration:none;
          padding:12px 18px;
          border-radius:10px;
          font-weight:700;
          letter-spacing:0.2px;
        "
      >
        ${text}
      </a>
    </div>
  `;
}

function layout({ preheader = '', title = '', bodyHtml = '' }) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const logo = COMPANY_LOGO_URL
    ? `<img src="${safeHref(COMPANY_LOGO_URL)}" alt="${escapeHtml(COMPANY_NAME)}" style="height:28px;display:block" />`
    : `<span style="font-weight:900;letter-spacing:-0.02em;color:#0b1f3a">${escapeHtml(COMPANY_NAME)}</span>`;

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${safePreheader}</div>
    <div style="background:#f6f7fb;padding:24px 0">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e9eaf1">
        <div style="padding:18px 22px;border-bottom:1px solid #eef0f6;background:#fbfcff">
          ${logo}
        </div>
        <div style="padding:26px 22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial;line-height:1.55;color:#0b1f3a">
          ${safeTitle ? `<h2 style="margin:0 0 12px;font-size:20px;line-height:1.2">${safeTitle}</h2>` : ''}
          ${bodyHtml}
        </div>
        <div style="padding:18px 22px;border-top:1px solid #eef0f6;background:#fbfcff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial;color:#6b7280;font-size:12px">
          <div style="margin-bottom:6px">${escapeHtml(COMPANY_NAME)}</div>
          <div>Do not reply to this email.</div>
        </div>
      </div>
    </div>
  `;
}

/** @deprecated Stage moves no longer trigger automated emails; retained for one-off / future use. */
export function stageAdvancedEmail(applicantName, stageName) {
  const portalUrl = `${getBaseUrl()}/applicant/login`;
  return {
    subject: `Your application has been updated — ${stageName}`,
    html: layout({
      preheader: `Your application moved to ${stageName}`,
      title: 'Application Update',
      bodyHtml: `
        <p>Hi ${escapeHtml(applicantName)},</p>
        <p>Your application has moved to the <strong>${escapeHtml(stageName)}</strong> stage.</p>
        <p>Log in to your applicant portal to see details.</p>
        ${button(portalUrl, 'Open Applicant Portal')}
        <p style="margin-top:18px">Team ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** Sent when an admin posts a message on the application thread. */
export function hrMessageToApplicantEmail({ applicantName, messagePreview, portalUrl }) {
  const safeName = escapeHtml(applicantName || 'Applicant');
  const raw = String(messagePreview || '').trim();
  const safeBody =
    raw.length > 2000 ? `${escapeHtml(raw.slice(0, 2000))}…` : escapeHtml(raw || 'You have a new message from our team.');
  return {
    subject: `New message from ${escapeHtml(COMPANY_NAME)}`,
    html: layout({
      preheader: 'New message from hiring team',
      title: 'You have a new message',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>You have a new message regarding your application:</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e9eaf1;font-size:14px;line-height:1.5;white-space:pre-wrap">${safeBody}</div>
        ${button(portalUrl, 'Read in Applicant Portal')}
        <p style="margin-top:18px">Team ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

export function onboardingInviteEmail(applicantName) {
  return {
    subject: 'You have been invited to complete onboarding',
    html: layout({
      preheader: 'Complete your onboarding',
      title: `Welcome to ${COMPANY_NAME}`,
      bodyHtml: `
        <p>Hi ${escapeHtml(applicantName)},</p>
        <p>You have been invited to complete your onboarding process.</p>
        <p>Please log in to your applicant portal to get started.</p>
        <p style="margin-top:18px">Team ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** Matches applicant onboarding “Required Documents” list (4 required + 2 conditional). */
const PORTAL_ONBOARDING_DOCUMENT_CHECKLIST = [
  'Passport (Front & Back)',
  'Work Authorization',
  'Government ID',
  'SIN Document',
  'Incorporation Document (if applicable)',
  'Direct Deposit — Void Check (if applicable)',
];

/** Sent when an admin approves initial application access to the applicant portal. */
export function applicantPortalApprovedEmail(applicantName, email, temporaryPassword, loginUrl, interview = null) {
  const safeName = escapeHtml(applicantName || 'Applicant');
  const safeEmail = escapeHtml(email || '');
  const escPw = escapeHtml(temporaryPassword || '');
  const safeLogin = safeHref(loginUrl || '#');
  const checklistHtml = `
        <hr style="border:none;border-top:1px solid #eee;margin:22px 0" />
        <p><strong>Next step: complete your documents</strong></p>
        <p style="font-size:13px;color:#374151;line-height:1.55">
          After you sign in, please upload each item below under <strong>Required Documents</strong>. If you already
          uploaded a file earlier in the process, it will appear in your portal — use <strong>Preview</strong> to review it
          and only upload what is still missing.
        </p>
        <ul style="margin:12px 0 16px;padding-left:20px;font-size:14px;line-height:1.5">
          ${PORTAL_ONBOARDING_DOCUMENT_CHECKLIST.map((label) => `<li>${escapeHtml(label)}</li>`).join('')}
        </ul>
        <p style="font-size:13px;color:#475569;background:#f8fafc;padding:14px 16px;border-radius:10px;border:1px solid #e9eaf1;line-height:1.55">
          <strong>Your privacy:</strong> Your documents are transmitted securely and used only for recruitment,
          eligibility checks, and verification for this selection process — not for unrelated purposes.
        </p>
      `;
  const interviewBlock =
    interview && (interview.date || interview.time || interview.title || interview.type || interview.link)
      ? `
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p><strong>Interview details</strong></p>
        <ul>
          ${interview.title ? `<li><strong>Title:</strong> ${escapeHtml(interview.title)}</li>` : ''}
          ${interview.type ? `<li><strong>Type:</strong> ${escapeHtml(interview.type)}</li>` : ''}
          ${interview.date ? `<li><strong>Date:</strong> ${escapeHtml(interview.date)}</li>` : ''}
          ${interview.time ? `<li><strong>Time:</strong> ${escapeHtml(interview.time)}</li>` : ''}
          ${
            interview.link
              ? `<li><strong>Meeting link:</strong> <a href="${safeHref(interview.link)}">${escapeHtml(interview.link)}</a></li>`
              : ''
          }
        </ul>
      `
      : '';
  return {
    subject: `You're Shortlisted! Your Login Credentials – ${escapeHtml(COMPANY_NAME)}`,
    html: layout({
      preheader: 'Your applicant portal credentials are ready',
      title: `You're Shortlisted!`,
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Congratulations — you’ve been shortlisted. You can now sign in to your applicant portal.</p>
        <p><strong>Portal login:</strong> <a href="${safeLogin}">${escapeHtml(loginUrl || '')}</a></p>
        <p><strong>Username:</strong> ${safeEmail}</p>
        <p><strong>Temporary password:</strong> <code style="font-size:14px">${escPw}</code></p>
        <p><strong>Important:</strong> Please change your password after your first login.</p>
        ${button(loginUrl, 'Login to Portal')}
        ${checklistHtml}
        ${interviewBlock}
        <p style="margin-top:18px">If you did not apply to ${escapeHtml(COMPANY_NAME)}, you can ignore this email.</p>
        <p style="margin-top:18px">HR Team, ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** 1) Forgot Password / Reset Password (Super Admin / Admin / Employee) */
export function passwordResetEmail({ fullName, role, resetLink, companyName }) {
  const safeName = escapeHtml(fullName || 'User');
  const safeRole = escapeHtml(role || 'User');
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  const link = safeHref(resetLink);
  return {
    subject: 'Password Reset Request – Action Required',
    html: layout({
      preheader: 'Reset your password (valid for 30 minutes)',
      title: 'Password Reset Request',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>We received a request to reset the password for your <strong>${safeRole}</strong> account.</p>
        <p>This link is valid for <strong>30 minutes</strong>.</p>
        ${button(resetLink, 'Reset Password')}
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p style="margin-top:18px">Team ${safeCompany}</p>
      `,
    }),
  };
}

/** Applicant/Employee reset email (used by forgot password flows). */
export function resetYourPasswordEmail({ fullName, resetLink, companyName }) {
  const safeName = escapeHtml(fullName || 'User');
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  return {
    subject: `Reset Your Password – ${safeCompany}`,
    html: layout({
      preheader: 'Reset your password (valid for 30 minutes)',
      title: 'Reset Your Password',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your password. This link is valid for <strong>30 minutes</strong>.</p>
        ${button(resetLink, 'Reset Password')}
        <p>If you did not request this, you can ignore this email.</p>
        <p style="margin-top:18px">Team ${safeCompany}</p>
      `,
    }),
  };
}

/** 2) Applicant Form Submitted (Acknowledgement) */
export function applicationSubmittedEmail({ name, email, phone, role, appliedDate, companyName, referenceId }) {
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  const safeName = escapeHtml(name || 'Applicant');
  const safeEmail = escapeHtml(email || '');
  const safePhone = escapeHtml(phone || '');
  const safeRole = escapeHtml(role || '');
  const submittedAt = escapeHtml(formatDate(appliedDate) || '');
  const safeRef = escapeHtml(referenceId || '');
  return {
    subject: `Application Received – ${safeRole || 'Role'} | ${safeCompany}`,
    html: layout({
      preheader: `Application received for ${safeRole || 'role'}`,
      title: 'Application Received',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Thank you — your application has been successfully submitted.</p>
        <p><strong>Submission details</strong></p>
        <ul>
          <li><strong>Full Name:</strong> ${safeName}</li>
          ${safeEmail ? `<li><strong>Email:</strong> ${safeEmail}</li>` : ''}
          ${safePhone ? `<li><strong>Phone:</strong> ${safePhone}</li>` : ''}
          ${safeRole ? `<li><strong>Position Applied For:</strong> ${safeRole}</li>` : ''}
          ${submittedAt ? `<li><strong>Submitted On:</strong> ${submittedAt}</li>` : ''}
          ${safeRef ? `<li><strong>Reference ID:</strong> ${safeRef}</li>` : ''}
        </ul>
        <p>Our HR team will review your application and get back to you with next steps.</p>
        <p style="margin-top:18px">HR Team, ${safeCompany}</p>
      `,
    }),
  };
}

export function newApplicationInternalEmail({ applicantId, name, email, phone, role, appliedDate, referenceId }) {
  const base = getBaseUrl();
  const viewLink = `${base}/admin/applications/${encodeURIComponent(applicantId)}`;
  const safeName = escapeHtml(name || 'Applicant');
  const safeEmail = escapeHtml(email || '');
  const safePhone = escapeHtml(phone || '');
  const safeRole = escapeHtml(role || '');
  const submittedAt = escapeHtml(formatDate(appliedDate) || '');
  const safeRef = escapeHtml(referenceId || '');

  return {
    to: HR_EMAIL,
    subject: `New Application Received – ${safeName}${safeRole ? ` for ${safeRole}` : ''}`,
    html: layout({
      preheader: 'New application received',
      title: 'New Application Received',
      bodyHtml: `
        <p>A new application was submitted.</p>
        <ul>
          <li><strong>Applicant ID:</strong> ${escapeHtml(applicantId || '')}</li>
          <li><strong>Full Name:</strong> ${safeName}</li>
          ${safeEmail ? `<li><strong>Email:</strong> ${safeEmail}</li>` : ''}
          ${safePhone ? `<li><strong>Phone:</strong> ${safePhone}</li>` : ''}
          ${safeRole ? `<li><strong>Position Applied:</strong> ${safeRole}</li>` : ''}
          ${submittedAt ? `<li><strong>Submitted On:</strong> ${submittedAt}</li>` : ''}
          ${safeRef ? `<li><strong>Reference ID:</strong> ${safeRef}</li>` : ''}
        </ul>
        ${button(viewLink, 'View in Admin Panel')}
        <p style="margin-top:18px">HR Team, ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** 3) Interview scheduled / updated (sent to applicant) */
export function interviewScheduledEmail({ name, role, portalUrl, interview }) {
  const safeName = escapeHtml(name || 'Applicant');
  const safeRole = escapeHtml(role || '');
  const safePortal = safeHref(portalUrl || '#');
  const iv = interview || {};
  return {
    subject: `Interview Scheduled – ${escapeHtml(COMPANY_NAME)}`,
    html: layout({
      preheader: 'Interview scheduled',
      title: 'Interview Scheduled',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Your interview has been scheduled${safeRole ? ` for <strong>${safeRole}</strong>` : ''}.</p>
        <ul>
          ${iv.title ? `<li><strong>Title:</strong> ${escapeHtml(iv.title)}</li>` : ''}
          ${iv.type ? `<li><strong>Type:</strong> ${escapeHtml(iv.type)}</li>` : ''}
          ${iv.date ? `<li><strong>Date:</strong> ${escapeHtml(iv.date)}</li>` : ''}
          ${iv.time ? `<li><strong>Time:</strong> ${escapeHtml(iv.time)}</li>` : ''}
          ${iv.link ? `<li><strong>Meeting link:</strong> <a href="${safeHref(iv.link)}">${escapeHtml(iv.link)}</a></li>` : ''}
        </ul>
        ${button(portalUrl, 'Open Applicant Portal')}
        <p style="margin-top:18px">HR Team, ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** 4) Onboarding started – verify & fill missing details */
export function onboardingMissingDetailsEmail({ name, missingFields, profileCompletionLink, companyName, deadline }) {
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  const safeName = escapeHtml(name || 'Employee');
  const link = safeHref(profileCompletionLink || '#');
  const items = Array.isArray(missingFields) ? missingFields : [];
  return {
    subject: `Welcome Aboard! Complete Your Profile to Get Started – ${safeCompany}`,
    html: layout({
      preheader: 'Complete your onboarding details',
      title: 'Complete Your Profile',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Congratulations — your onboarding process has started and your account is almost ready.</p>
        ${
          items.length
            ? `
              <p><strong>Pending items to complete</strong></p>
              <ul>
                ${items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
              </ul>
            `
            : ''
        }
        ${button(profileCompletionLink, 'Complete Profile')}
        ${deadline ? `<p><strong>Deadline:</strong> ${escapeHtml(deadline)}</p>` : ''}
        <p>Your data is secured and encrypted.</p>
        <p style="margin-top:18px">HR Team, ${safeCompany}</p>
      `,
    }),
  };
}

/** 5) Converted to Employee (with login credentials) */
export function employeeConversionEmail({
  fullName,
  designation,
  department,
  joiningDate,
  employeeId,
  officialEmail,
  tempPassword,
  portalUrl,
  companyName,
}) {
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  const safeName = escapeHtml(fullName || 'Employee');
  return {
    subject: `🎉 Welcome to the Team! You're Now an Official Employee – ${safeCompany}`,
    html: layout({
      preheader: 'Your employee portal credentials are ready',
      title: `Welcome to ${safeCompany}`,
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Congratulations — you’re now an official employee.</p>
        <ul>
          ${designation ? `<li><strong>Designation:</strong> ${escapeHtml(designation)}</li>` : ''}
          ${department ? `<li><strong>Department:</strong> ${escapeHtml(department)}</li>` : ''}
          ${joiningDate ? `<li><strong>Joining Date:</strong> ${escapeHtml(joiningDate)}</li>` : ''}
        </ul>
        <p><strong>Your employee portal login</strong></p>
        <ul>
          ${employeeId ? `<li><strong>Employee ID:</strong> ${escapeHtml(employeeId)}</li>` : ''}
          ${officialEmail ? `<li><strong>Username:</strong> ${escapeHtml(officialEmail)}</li>` : ''}
          ${tempPassword ? `<li><strong>Temporary Password:</strong> <code style="font-size:14px">${escapeHtml(tempPassword)}</code></li>` : ''}
        </ul>
        ${button(portalUrl, 'Login to Employee Portal')}
        <p>Please sign in and reset your password immediately.</p>
        <p style="margin-top:18px">HR Team, ${safeCompany}</p>
      `,
    }),
  };
}

export function newEmployeeInternalEmail({ fullName, employeeId, email, designation, department }) {
  const safeName = escapeHtml(fullName || 'Employee');
  const safeId = escapeHtml(employeeId || '');
  const safeEmail = escapeHtml(email || '');
  return {
    to: HR_EMAIL,
    subject: `New Employee Created – ${safeName}${safeId ? ` (${safeId})` : ''}`,
    html: layout({
      preheader: 'New employee created',
      title: 'New Employee Created',
      bodyHtml: `
        <ul>
          ${safeId ? `<li><strong>Employee ID:</strong> ${safeId}</li>` : ''}
          <li><strong>Full Name:</strong> ${safeName}</li>
          ${safeEmail ? `<li><strong>Email:</strong> ${safeEmail}</li>` : ''}
          ${designation ? `<li><strong>Designation:</strong> ${escapeHtml(designation)}</li>` : ''}
          ${department ? `<li><strong>Department:</strong> ${escapeHtml(department)}</li>` : ''}
        </ul>
        <p style="margin-top:18px">HR Team, ${escapeHtml(COMPANY_NAME)}</p>
      `,
    }),
  };
}

/** 6) Rejection email */
export function applicationRejectedEmail({ fullName, jobTitle, companyName, careersPageLink, rejectionReason }) {
  const safeCompany = escapeHtml(companyName || COMPANY_NAME);
  const safeName = escapeHtml(fullName || 'Applicant');
  const safeJob = escapeHtml(jobTitle || '');
  const safeReason = String(rejectionReason || '').trim();
  const safeCareers = String(careersPageLink || '').trim();
  return {
    subject: `Update on Your Application – ${safeJob || 'Role'} | ${safeCompany}`,
    html: layout({
      preheader: 'Update on your application',
      title: 'Update on Your Application',
      bodyHtml: `
        <p>Hi ${safeName},</p>
        <p>Thank you for your time, effort, and interest in ${safeCompany}.</p>
        <p>After careful consideration, we will not be moving forward with your application${safeJob ? ` for <strong>${safeJob}</strong>` : ''} at this time.</p>
        ${safeReason ? `<p><strong>Note:</strong> ${escapeHtml(safeReason)}</p>` : ''}
        <p>We appreciate your efforts and encourage you to apply again for future openings.</p>
        ${
          safeCareers
            ? `${button(safeCareers, 'View Careers')}`
            : ''
        }
        <p style="margin-top:18px">HR Team, ${safeCompany}</p>
      `,
    }),
  };
}
