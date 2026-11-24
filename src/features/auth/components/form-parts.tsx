'use client';
import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHydrated } from '@/hooks/use-hydrated';
import type { FormState } from '../schema';

/** Form-level message. Errors move focus here and are announced (WCAG 3.3.1, MP §10). */
export function FormMessage({ state }: { state: FormState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === 'error') ref.current?.focus();
  }, [state]);
  if (state.status === 'idle' || !state.message) return null;
  const error = state.status === 'error';
  const Icon = error ? CircleAlert : CircleCheck;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={error ? 'alert' : 'status'}
      className={`mb-4 flex gap-2 rounded-md border p-3 text-sm ${error ? 'border-destructive text-destructive' : 'border-success text-success'}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{state.message}</p>
    </div>
  );
}

export function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  hint,
  errors,
  defaultValue,
  inputMode,
  autoFocus,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  errors?: string[] | undefined;
  defaultValue?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoFocus?: boolean;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = errors?.length ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <Input
        id={name}
        name={name}
        type={type}
        required
        {...(autoComplete ? { autoComplete } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        {...(inputMode ? { inputMode } : {})}
        {...(autoFocus ? { autoFocus } : {})}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
        aria-invalid={errors?.length ? true : undefined}
      />
      {errors?.length ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const hydrated = useHydrated();
  // Disabled until hydrated: see useHydrated() for why a pre-hydration submit is unsafe.
  const disabled = pending || !hydrated;
  return (
    <Button type="submit" className="w-full" disabled={disabled} aria-disabled={disabled}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
