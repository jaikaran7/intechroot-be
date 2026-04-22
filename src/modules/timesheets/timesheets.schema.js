import { z } from 'zod';

/** Hours per day: number 0–24 or null (not yet entered). */
function dayField() {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isNaN(n)) return null;
    return Math.min(24, Math.max(0, n));
  }, z.union([z.null(), z.number().min(0).max(24)]));
}

const weekDataSchema = z.object({
  mon: dayField(),
  tue: dayField(),
  wed: dayField(),
  thu: dayField(),
  fri: dayField(),
  sat: dayField(),
  sun: dayField(),
});

export const createTimesheetSchema = z
  .object({
    weekStart: z.string().min(1, 'Week start date is required'),
    weekData: weekDataSchema,
    notes: z.string().optional(),
    /** Inclusive YYYY-MM-DD; both set or both omitted (then derived from weekStart week). */
    periodStart: z.string().min(1).optional(),
    periodEnd: z.string().min(1).optional(),
  })
  .refine(
    (d) => {
      const a = !!d.periodStart;
      const b = !!d.periodEnd;
      return a === b;
    },
    { message: 'periodStart and periodEnd must both be provided or both omitted', path: ['periodEnd'] },
  );

export const rejectTimesheetSchema = z.object({
  rejectionNote: z.string().min(1, 'Rejection note is required'),
});
