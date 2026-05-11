import { z } from 'zod';

const personalShape = z.object({
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  nationality: z.string().optional(),
});

const employmentShape = z.object({
  employmentType: z.string().optional(),
  jobTitle: z.string().optional(),
  timeZone: z.string().optional(),
  shiftType: z.string().optional(),
  salary: z.string().optional(),
  payFrequency: z.string().optional(),
  contractType: z.string().optional(),
  contractTypeDescription: z.string().optional(),
  employmentStatus: z.string().optional(),
  employmentStatusTag: z.string().optional(),
  joiningDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  directManager: z.string().optional(),
  experience: z.string().optional(),
});

/** Accepts nested personal/employment and flat keys from the profile form (admin UI). */
export const updateEmployeeSchema = z
  .object({
    employeeCode: z
      .string()
      .trim()
      .regex(/^INTR-\d{2}-\d{4}$/, 'Employee ID must match INTR-YY-0001')
      .optional(),
    name: z.string().min(1).optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    client: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    personal: personalShape.optional(),
    employment: employmentShape.optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    nationality: z.string().optional(),
    employmentType: z.string().optional(),
    jobTitle: z.string().optional(),
    timeZone: z.string().optional(),
    shiftType: z.string().optional(),
    salary: z.string().optional(),
    payFrequency: z.string().optional(),
    contractType: z.string().optional(),
    contractTypeDescription: z.string().optional(),
    employmentStatus: z.string().optional(),
    employmentStatusTag: z.string().optional(),
    joiningDate: z.string().optional(),
    contractEndDate: z.string().optional(),
    directManager: z.string().optional(),
    experience: z.string().optional(),
    status: z.enum(['Active', 'On_Leave', 'Inactive']).optional(),
  })
  .partial();

/** Direct hire from admin wizard (no application). */
export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  department: z.string().min(1),
  phone: z.string().optional().default(''),
  client: z.string().optional().default(''),
  status: z.enum(['Active', 'On_Leave', 'Inactive']).optional().default('Active'),
  personal: personalShape.optional(),
  employment: employmentShape.optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  nationality: z.string().optional(),
  employmentType: z.string().optional(),
  jobTitle: z.string().optional(),
  timeZone: z.string().optional(),
  shiftType: z.string().optional(),
  salary: z.string().optional(),
  payFrequency: z.string().optional(),
  contractType: z.string().optional(),
  contractTypeDescription: z.string().optional(),
  employmentStatus: z.string().optional(),
  employmentStatusTag: z.string().optional(),
  joiningDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  directManager: z.string().optional(),
  experience: z.string().optional(),
});

export const employeeStatusSchema = z.object({
  status: z.enum(['Active', 'On_Leave', 'Inactive']),
});

export const extraDocumentRequestSchema = z.object({
  name: z.string().trim().min(1, 'Document name is required').max(200, 'Name is too long'),
});

export const employeeDashboardMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000, 'Message is too long'),
});
