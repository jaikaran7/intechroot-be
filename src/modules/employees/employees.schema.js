import { z } from 'zod';

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  client: z.string().optional(),
  phone: z.string().optional(),
  personal: z.object({
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  employment: z.object({
    employmentType: z.string().optional(),
    jobTitle: z.string().optional(),
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
  }).optional(),
}).partial();

export const employeeStatusSchema = z.object({
  status: z.enum(['Active', 'On_Leave', 'Inactive']),
});
