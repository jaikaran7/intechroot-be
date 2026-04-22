import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(1),
  sector: z.string().min(1),
  category: z.string().default(''),
  seniority: z.string().min(1),
  contract: z.enum(['Permanent', 'Consulting']).default('Permanent'),
  jobType: z.string().default('Full-time'),
  location: z.string().min(1),
  salary: z.string().default(''),
  description: z.string().default(''),
  requirements: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  experience: z.string().default(''),
  status: z.enum(['Active', 'Draft', 'Closed']).default('Draft'),
  featured: z.coerce.boolean().default(false),
});

export const updateJobSchema = createJobSchema.partial();

export const jobStatusSchema = z.object({
  status: z.enum(['Active', 'Draft', 'Closed']),
});

export const reorderJobsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
