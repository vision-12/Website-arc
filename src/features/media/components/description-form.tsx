'use client';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHydrated } from '@/hooks/use-hydrated';
import { updateMedia } from '../actions';
import { AltText, Caption, MESSAGES, type MediaItem } from '../schema';

/**
 * "Photo description (for blind visitors and Google)" — plain language for alt text (MP §11).
 * With `required`, the photo can't be used until it has one (MP §5.9).
 */
export function DescriptionForm({
  item,
  onSaved,
  required = false,
  submitLabel = 'Save description',
  focusOnOpen = false,
}: {
  item: MediaItem;
  onSaved: (item: MediaItem) => void;
  required?: boolean;
  submitLabel?: string;
  /** Moves focus to the description when the form opens on its own (the picker's step). */
  focusOnOpen?: boolean;
}) {
  const id = useId();
  const hydrated = useHydrated();
  const [alt, setAlt] = useState(item.altText);
  const [caption, setCaption] = useState(item.caption);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const a = AltText.safeParse(alt);
        const c = Caption.safeParse(caption);
        if (!a.success) return setError(a.error.issues[0]?.message ?? MESSAGES.missingAlt);
        if (!c.success) return setError(c.error.issues[0]?.message ?? 'Please check the caption.');
        if (required && a.data === '') return setError(MESSAGES.missingAlt);
        setError(null);
        start(async () => {
          const r = await updateMedia({
            id: item.id,
            version: item.version,
            altText: a.data,
            caption: c.data,
          });
          if (r.ok) onSaved(r.data);
          else
            setError(
              r.error.code === 'CONFLICT'
                ? 'Someone else changed this photo. Close it and open it again to see their changes.'
                : r.error.message,
            );
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-alt`}>Photo description (for blind visitors and Google)</Label>
        <Textarea
          id={`${id}-alt`}
          value={alt}
          rows={3}
          maxLength={250}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the description step opens for this field alone
          autoFocus={focusOnOpen}
          onChange={(e) => setAlt(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-alt-hint${error ? ` ${id}-error` : ''}`}
        />
        <p id={`${id}-alt-hint`} className="text-sm text-muted-foreground">
          {required ? '' : 'Needed before the photo can be used on the website. '}Say what the photo
          shows in one sentence, for example “Senior two pupils planting trees beside the library”.{' '}
          {alt.length}/250
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-caption`}>Caption (optional, shown under the photo)</Label>
        <Input
          id={`${id}-caption`}
          value={caption}
          maxLength={500}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
