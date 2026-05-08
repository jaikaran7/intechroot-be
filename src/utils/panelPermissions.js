import prisma from '../config/db.js';
import { ForbiddenError } from './errors.js';
import { isInternalPoolEmployee } from './internalPool.js';

/** All boolean flags persisted on AdminProfile.permissions for hr_admin users. */
export const HR_ADMIN_PERMISSION_KEYS = [
  'approveTimesheets',
  'rejectTimesheets',
  'editTimesheets',
  'viewEmployeeDetails',
  'editEmployeeDetails',
  'viewApplicationJourney',
  'editApplicationStage',
  'acceptRejectApplicantDocuments',
  'sendInterviewLinks',
  'sendMessagesToApplicants',
  'manageOnboardingProcess',
  'scheduleInterview',
  'portalApproveRejectApplicant',
  'advanceApplicationStage',
  'approveApplicantProfile',
  'requestAdditionalDocuments',
  'setBGVDetails',
  'approveBGVVerification',
  'finalHireRejectApplicant',
  'verifyApplicantDocuments',
  'requestExtraEmployeeDocuments',
  'viewEmployeeDocuments',
  'viewJobPostings',
  'createEditJobPostings',
  'openCloseJobPostings',
];

/** Grouped labels for super-admin UI when creating/editing HR admins. */
export const HR_ADMIN_PERMISSION_GROUPS = [
  {
    id: 'timesheet',
    label: 'Timesheet Management',
    keys: [
      { key: 'approveTimesheets', label: 'Approve Timesheets' },
      { key: 'rejectTimesheets', label: 'Reject Timesheets' },
      { key: 'editTimesheets', label: 'Edit Timesheets' },
    ],
  },
  {
    id: 'employee',
    label: 'Employee Management',
    keys: [
      { key: 'viewEmployeeDetails', label: 'View Employee Details' },
      { key: 'editEmployeeDetails', label: 'Edit Employee Details' },
    ],
  },
  {
    id: 'application',
    label: 'Application Management',
    keys: [
      { key: 'viewApplicationJourney', label: 'View Application Journey' },
      { key: 'editApplicationStage', label: 'Edit / Update Application Journey Stage' },
      { key: 'acceptRejectApplicantDocuments', label: 'Accept or Reject Applicant Documents' },
      { key: 'sendInterviewLinks', label: 'Send Meeting / Interview Links' },
      { key: 'sendMessagesToApplicants', label: 'Send Messages to Applicants' },
      { key: 'scheduleInterview', label: 'Schedule / Reschedule / Cancel Interviews' },
      { key: 'portalApproveRejectApplicant', label: 'Approve or Reject at Portal Review' },
      { key: 'advanceApplicationStage', label: 'Advance Application Lifecycle Stage' },
    ],
  },
  {
    id: 'onboarding',
    label: 'Onboarding Management',
    keys: [
      { key: 'manageOnboardingProcess', label: 'Manage Onboarding Process' },
      { key: 'approveApplicantProfile', label: 'Approve Applicant Profile (Onboarding)' },
      { key: 'requestAdditionalDocuments', label: 'Request Additional Documents from Applicant' },
      { key: 'setBGVDetails', label: 'Set BGV Link and Note' },
      { key: 'approveBGVVerification', label: 'Mark BGV as Verified' },
      { key: 'finalHireRejectApplicant', label: 'Final Hire or Reject After Onboarding' },
    ],
  },
  {
    id: 'documents',
    label: 'Document Management',
    keys: [
      { key: 'verifyApplicantDocuments', label: 'Verify or Reject Applicant-Uploaded Documents' },
      { key: 'requestExtraEmployeeDocuments', label: 'Request Extra Documents from Employees' },
      { key: 'viewEmployeeDocuments', label: "View assigned employees' documents" },
    ],
  },
  {
    id: 'jobs',
    label: 'Job Postings',
    keys: [
      { key: 'viewJobPostings', label: 'View Job Postings' },
      { key: 'createEditJobPostings', label: 'Create and Edit Job Postings' },
      { key: 'openCloseJobPostings', label: 'Open, Close, or Draft Job Postings' },
    ],
  },
];

export function normalizeClientAdminPermissions(raw = {}) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    approveTimesheets: Boolean(v.approveTimesheets),
    rejectTimesheets: Boolean(v.rejectTimesheets),
  };
}

/**
 * Grants new granular keys from legacy overlapping keys (read-time only; JSON on disk unchanged).
 * Skips viewEmployeeDocuments / requestExtraEmployeeDocuments — different assignment scope than legacy.
 */
function applyHrAdminLegacyPermissionGrants(out) {
  if (out.sendInterviewLinks) out.scheduleInterview = true;
  if (out.acceptRejectApplicantDocuments) {
    out.portalApproveRejectApplicant = true;
    out.verifyApplicantDocuments = true;
  }
  if (out.editApplicationStage) {
    out.advanceApplicationStage = true;
    out.finalHireRejectApplicant = true;
  }
  if (out.manageOnboardingProcess) {
    out.approveApplicantProfile = true;
    out.requestAdditionalDocuments = true;
    out.setBGVDetails = true;
    out.approveBGVVerification = true;
  }
  return out;
}

export function normalizeHrAdminPermissions(raw = {}) {
  const v = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of HR_ADMIN_PERMISSION_KEYS) {
    out[key] = Boolean(v[key]);
  }
  return applyHrAdminLegacyPermissionGrants(out);
}

export function normalizePermissionsForUserRole(userRole, raw) {
  if (userRole === 'hr_admin') {
    return normalizeHrAdminPermissions(raw);
  }
  return normalizeClientAdminPermissions(raw);
}

export async function getNormalizedPermissionsForAdminUser(adminUserId) {
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });
  if (!user) {
    return normalizeClientAdminPermissions({});
  }
  const profile = await prisma.adminProfile.findUnique({
    where: { adminUserId },
    select: { permissions: true },
  });
  return normalizePermissionsForUserRole(user.role, profile?.permissions);
}

const BYPASS_PANEL_CHECKS = new Set(['super_admin', 'admin', 'ADMIN']);

/**
 * Enforce a single hr_admin permission stored on AdminProfile.
 * Legacy/lowercase admin, enterprise ADMIN, and super_admin bypass.
 */
export async function assertHrAdminPanelPermission(requestingUser, permissionKey) {
  if (!requestingUser) throw new ForbiddenError();
  const r = requestingUser.role;
  if (BYPASS_PANEL_CHECKS.has(r)) return;
  if (r !== 'hr_admin') throw new ForbiddenError();
  const perms = await getNormalizedPermissionsForAdminUser(requestingUser.userId);
  if (!perms[permissionKey]) {
    throw new ForbiddenError('You do not have permission for this action');
  }
}

/** True if any listed permission is enabled (used for legacy + granular HR admin keys). */
export async function assertHrAdminPanelPermissionAny(requestingUser, permissionKeys) {
  if (!requestingUser) throw new ForbiddenError();
  const r = requestingUser.role;
  if (BYPASS_PANEL_CHECKS.has(r)) return;
  if (r !== 'hr_admin') throw new ForbiddenError();
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [];
  if (!keys.length) throw new ForbiddenError();
  const perms = await getNormalizedPermissionsForAdminUser(requestingUser.userId);
  const ok = keys.some((k) => perms[k]);
  if (!ok) {
    throw new ForbiddenError('You do not have permission for this action');
  }
}

/** HR admin read access to an employee’s documents (assignment or legacy internal-pool rule). */
export async function assertHrAdminEmployeeDocumentAccess(requestingUser, employeeId) {
  if (requestingUser?.role !== 'hr_admin') return;
  const perms = await getNormalizedPermissionsForAdminUser(requestingUser.userId);
  if (perms.viewEmployeeDocuments) {
    const row = await prisma.employeeAssignment.findFirst({
      where: { adminUserId: requestingUser.userId, employeeId, isActive: true },
      select: { id: true },
    });
    if (!row) {
      throw new ForbiddenError('Employee is not assigned to this HR admin');
    }
    return;
  }
  if (perms.viewEmployeeDetails) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { client: true },
    });
    if (!emp || !isInternalPoolEmployee(emp)) {
      throw new ForbiddenError();
    }
    return;
  }
  throw new ForbiddenError('You do not have permission for this action');
}

/** HR admin may request extra employee documents: assignment-based or legacy internal-pool edit. */
export async function assertHrAdminExtraEmployeeDocumentRequestAccess(requestingUser, employeeId) {
  if (requestingUser?.role !== 'hr_admin') return;
  const perms = await getNormalizedPermissionsForAdminUser(requestingUser.userId);
  if (perms.requestExtraEmployeeDocuments) {
    const row = await prisma.employeeAssignment.findFirst({
      where: { adminUserId: requestingUser.userId, employeeId, isActive: true },
      select: { id: true },
    });
    if (!row) {
      throw new ForbiddenError('Employee is not assigned to this HR admin');
    }
    return;
  }
  if (perms.editEmployeeDetails) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { client: true },
    });
    if (!emp || !isInternalPoolEmployee(emp)) {
      throw new ForbiddenError();
    }
    return;
  }
  throw new ForbiddenError('You do not have permission for this action');
}
