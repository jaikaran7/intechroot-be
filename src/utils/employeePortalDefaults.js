/**
 * Default password for new employee portal accounts (after hire) and backfill scripts.
 * Override with env DEFAULT_EMPLOYEE_PORTAL_PASSWORD.
 */
export function getDefaultEmployeePortalPassword() {
  return process.env.DEFAULT_EMPLOYEE_PORTAL_PASSWORD || 'Employee@123';
}
