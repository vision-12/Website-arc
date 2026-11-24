import type { z } from 'zod';
import { fieldErrorsOf, type FormState } from './schema';

/**
 * Form helpers shared by the browser and the server actions, so both answer a mistake with the
 * same messages and keep the same fields (MP §12: "Zod schemas shared client/server").
 */

/** The text fields of a submitted form. Files are ignored. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

const SECRET_FIELDS = new Set(['password', 'confirm', 'code']);

/** Echo back what the user typed, except secrets, so the form isn't emptied after an error. */
export function keepValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(formValues(formData)))
    if (!SECRET_FIELDS.has(k) && v.length <= 254) out[k] = v;
  return out;
}

export function invalidState(formData: FormData, fieldErrors: Record<string, string[]>): FormState {
  return {
    status: 'error',
    message: 'Please check the highlighted fields.',
    fieldErrors,
    values: keepValues(formData),
  };
}

/**
 * Check a form with the schema its server action uses. Returns the error state to show, or null
 * when the input may be sent. The action validates again: the browser is never trusted.
 */
export function checkForm(schema: z.ZodType, formData: FormData): FormState | null {
  const parsed = schema.safeParse(formValues(formData));
  return parsed.success ? null : invalidState(formData, fieldErrorsOf(parsed.error));
}
