import { Resend } from 'resend';

const FROM = process.env.FROM_EMAIL || 'noreply@intechroot.com';
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

export function stageAdvancedEmail(applicantName, stageName) {
  return {
    subject: `Your application has been updated — ${stageName}`,
    html: `
      <h2>Application Update</h2>
      <p>Hi ${applicantName},</p>
      <p>Your application has moved to the <strong>${stageName}</strong> stage.</p>
      <p>Log in to your applicant portal to see details.</p>
      <br/>
      <p>InTech Root Team</p>
    `,
  };
}

export function onboardingInviteEmail(applicantName) {
  return {
    subject: 'You have been invited to complete onboarding',
    html: `
      <h2>Welcome to InTech Root</h2>
      <p>Hi ${applicantName},</p>
      <p>You have been invited to complete your onboarding process.</p>
      <p>Please log in to your applicant portal to get started.</p>
      <br/>
      <p>InTech Root Team</p>
    `,
  };
}

/** Sent when an admin approves initial application access to the applicant portal. */
export function applicantPortalApprovedEmail(applicantName, email, temporaryPassword, loginUrl) {
  const safeName = String(applicantName || 'Applicant').replace(/</g, '');
  const safeEmail = String(email || '').replace(/</g, '');
  const escPw = String(temporaryPassword || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeLogin = String(loginUrl || '#').replace(/"/g, '');
  return {
    subject: 'Your InTech Root applicant portal is ready',
    html: `
      <h2>Welcome, ${safeName}</h2>
      <p>Your application has been reviewed and <strong>approved</strong>. You can now sign in to your applicant portal.</p>
      <p><strong>Sign-in link:</strong> <a href="${safeLogin}">${safeLogin}</a></p>
      <p><strong>Email (login):</strong> ${safeEmail}</p>
      <p><strong>Temporary password:</strong> <code style="font-size:14px">${escPw}</code></p>
      <p>Please sign in and change your password if prompted, or keep this password secure until you update it.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
      <p><strong>What to do next</strong></p>
      <ul>
        <li>Upload any requested documents from the portal.</li>
        <li>Check <strong>Interviews</strong> regularly for scheduled sessions and links.</li>
        <li>Read <strong>Messages</strong> from the team for updates.</li>
        <li>Complete onboarding steps when your status moves forward.</li>
      </ul>
      <p>If you did not apply to InTech Root, you can ignore this email.</p>
      <br/>
      <p>InTech Root Team</p>
    `,
  };
}
