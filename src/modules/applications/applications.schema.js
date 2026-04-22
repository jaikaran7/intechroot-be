import { z } from 'zod';

export const createApplicationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  discipline: z.string().min(1, 'Discipline is required'),
  experience: z.string().min(1, 'Experience is required'),
  location: z.string().default(''),
  linkedIn: z.string().url().optional().or(z.literal('')),
  portfolio: z.string().url().optional().or(z.literal('')),
  skills: z.array(z.string()).default([]),
  jobId: z.string().optional(),
  resumeFileName: z.string().optional(),
});

export const advanceStageSchema = z.object({
  note: z.string().optional(),
});

/** Accepts full URLs or host/path pasted without a scheme (e.g. meet.google.com/...); empty clears optional link. */
const interviewMeetingLinkSchema = z.preprocess(
  (val) => {
    if (val == null || val === '') return '';
    const s = String(val).trim();
    if (!s) return '';
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(s)) return s;
    return `https://${s}`;
  },
  z.union([z.literal(''), z.string().url({ message: 'Meeting link must be a valid URL' })]),
);

export const createInterviewSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.string().default('Technical'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  link: interviewMeetingLinkSchema.optional(),
  notes: z.string().optional(),
});

export const updateInterviewSchema = createInterviewSchema.extend({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
}).partial();

export const createMessageSchema = z.object({
  text: z.string().min(1, 'Message text is required'),
});
