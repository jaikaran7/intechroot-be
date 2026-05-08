/**
 * Internal / integrated pool employees: no external client placement string set.
 * Empty or whitespace-only `Employee.client` counts as internal.
 */
export function isInternalPoolClientValue(client) {
  return String(client ?? '').trim() === '';
}

export function internalPoolEmployeeWhere() {
  return { client: '' };
}

/** @param {{ client?: string }} employee */
export function isInternalPoolEmployee(employee) {
  if (!employee) return false;
  return isInternalPoolClientValue(employee.client);
}
