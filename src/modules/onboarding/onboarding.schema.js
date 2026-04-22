import { z } from 'zod';

const nonEmptyString = (message) =>
  z.string({ required_error: message }).trim().min(1, message);

export const profileStepSchema = z.object({
  firstName: nonEmptyString('First name is required'),
  lastName: nonEmptyString('Last name is required'),
  email: nonEmptyString('Email is required').email('Enter a valid email'),
  phone: nonEmptyString('Phone number is required'),
  dateOfBirth: nonEmptyString('Date of birth is required'),
  nationality: nonEmptyString('Nationality is required'),
  profilePhotoUrl: z.string().trim().min(1, 'Profile photo is required'),
  profilePhotoName: z.string().trim().optional(),
});

export const profileStepPartialSchema = profileStepSchema.partial();

export const bgvAcknowledgeSchema = z.object({
  acknowledged: z.literal(true, { errorMap: () => ({ message: 'You must acknowledge the BGV step' }) }),
});

export const adminDocRequestSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
});

export const adminBgvSchema = z.object({
  bgvLink: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (v == null || v === '') return true;
        try {
          // eslint-disable-next-line no-new
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'BGV link must be a valid URL' },
    ),
  bgvNote: z.string().optional(),
});

export const adminDocApproveSchema = z.object({
  approved: z.boolean(),
  rejectionNote: z.string().optional(),
});
