'use client';
import { useState, type SubmitEvent } from 'react';
import type { z } from 'zod';
import { checkForm } from '../form-state';
import type { FormState } from '../schema';

/**
 * Checks a form in the browser with its server action's own schema. An invalid form is not sent:
 * the submit is cancelled and the errors show at once. The form keeps the server action as its
 * `action`, so React renders it progressively enhanced. A client-function action would make React
 * add an inline form-replay script, which has no nonce in a prerendered shell (ADR-000).
 */
export function useClientCheck(schema: z.ZodType) {
  const [clientState, setClientState] = useState<FormState | null>(null);
  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    const problem = checkForm(schema, new FormData(event.currentTarget));
    setClientState(problem);
    if (problem) event.preventDefault();
  }
  return { clientState, onSubmit };
}
