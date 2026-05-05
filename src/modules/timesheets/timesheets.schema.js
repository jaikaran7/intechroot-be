import { z } from 'zod';

/** Hours 0–24, null (empty), or L / O (leave / off). */
function dayField() {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'string') {
      const u = val.trim().toUpperCase();
      if (u === 'L' || u === 'O') return u;
    }
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isNaN(n)) return null;
    return Math.min(24, Math.max(0, n));
  }, z.union([z.null(), z.number().min(0).max(24), z.literal('L'), z.literal('O')]));
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
