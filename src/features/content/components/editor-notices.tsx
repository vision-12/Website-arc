'use client';
import { useState } from 'react';
import { CalendarClock, MessageSquareWarning, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  formatDateTimeLong,
  formatDateTimeShort,
  utcToZoned,
  zonedTimeToUtc,
} from '@/lib/dates/zoned';
import { MESSAGES } from '@/lib/actions/errors';
import { cn } from '@/lib/utils';
import type { OtherEditor, ReviewNote } from '../schema';

function Notice({
  tone = 'info',
  icon: Icon,
  children,
  actions,
}: {
  tone?: 'info' | 'warning';
  icon: typeof Users;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center',
        tone === 'warning' ? 'border-warning bg-warning/10' : 'bg-card',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">{children}</div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const minutesAgo = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1
    ? 'just now'
    : m === 1
      ? '1 minute ago'
      : m < 60
        ? `${m} minutes ago`
        : 'over an hour ago';
};

/**
 * Someone else has unsaved changes to the same item (plan P4-D), within the last two minutes.
 * Announced politely. `now` comes from the editor's polling timer (render stays pure).
 */
export function OtherEditorsNotice({ editors, now }: { editors: OtherEditor[]; now: number }) {
  const recent = editors.filter((e) => now - new Date(e.updatedAt).getTime() < 120_000);
  const latest = recent[0];
  return (
    <div aria-live="polite">
      {latest ? (
        <Notice icon={Users} tone="warning">
          <strong>{recent.map((e) => e.name).join(' and ')}</strong>{' '}
          {recent.length === 1 ? 'is' : 'are'} also editing this page (last change{' '}
          {minutesAgo(latest.updatedAt, now)}). Agree who publishes, so you don’t undo each other’s
          work.
        </Notice>
      ) : null}
    </div>
  );
}

/** Your working copy started before someone else's edit (P4-D): your text is kept, never applied silently. */
export function StaleCopyNotice({
  savedAt,
  now,
  onShow,
  onDiscard,
  busy,
}: {
  savedAt: string;
  now: number;
  onShow: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  return (
    <Notice
      icon={MessageSquareWarning}
      tone="warning"
      actions={
        <>
          <Button size="sm" onClick={onShow} disabled={busy}>
            Show my changes
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>
            Discard them
          </Button>
        </>
      }
    >
      You have unsaved changes from {minutesAgo(savedAt, now)}, made before someone else changed
      this page. The page below shows their version.
    </Notice>
  );
}

/** Your saved working copy is shown in the editor; on a live item it isn't public yet. */
export function UnsavedCopyNotice({
  live,
  savedAt,
  now,
  onDiscard,
  busy,
}: {
  live: boolean;
  savedAt: string;
  now: number;
  onDiscard: () => void;
  busy: boolean;
}) {
  return (
    <Notice
      icon={CalendarClock}
      actions={
        <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>
          Discard changes
        </Button>
      }
    >
      {live
        ? `You have unpublished changes (saved ${minutesAgo(savedAt, now)}). Visitors still see the published version until you publish them.`
        : `Your changes from ${minutesAgo(savedAt, now)} were kept and are shown below.`}
    </Notice>
  );
}

/** Someone else saved while you were editing: your text is kept, and publishing would be refused. */
export function RemoteChangeNotice() {
  return (
    <div role="status">
      <Notice
        icon={RefreshCw}
        tone="warning"
        actions={
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload to see their changes
          </Button>
        }
      >
        Someone else has saved changes to this page since you opened it. Your changes are kept.
      </Notice>
    </div>
  );
}

/** The approver's note from "Send back" (approval workflow, P4-A). */
export function ReviewNoteCallout({ note, timezone }: { note: ReviewNote; timezone: string }) {
  return (
    <Notice icon={MessageSquareWarning} tone="warning">
      <p>
        <strong>Sent back by {note.author}</strong> on{' '}
        {formatDateTimeShort(note.createdAt, timezone)}:
      </p>
      <p className="mt-1 whitespace-pre-line">“{note.note}”</p>
    </Notice>
  );
}

/** MP §5: "Someone else edited this — reload to see their changes." Your text is kept. */
export function ConflictDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="Close" role="alertdialog">
        <DialogHeader>
          <DialogTitle>{MESSAGES.CONFLICT}</DialogTitle>
          <DialogDescription>
            Your changes were not published, and they are not lost: after reloading you can show
            them again and decide what to keep.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Schedule…": the date and time are in the school's time zone; stored in UTC. */
export function ScheduleDialog({
  open,
  onOpenChange,
  timezone,
  current,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  timezone: string;
  current: string | null;
  onConfirm: (publishAtIso: string) => void;
  busy: boolean;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const zoneLabel =
    timezone === 'Africa/Kampala' ? 'East Africa Time (Kampala)' : timezone.replace(/_/g, ' ');
  const preview = date && time ? zonedTimeToUtc(date, time, timezone) : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          const start =
            current && new Date(current) > new Date()
              ? new Date(current)
              : new Date(Date.now() + 24 * 3_600_000);
          const z = utcToZoned(start, timezone);
          setDate(z.date);
          setTime(current ? z.time : '08:00');
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent closeLabel="Close">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const at = zonedTimeToUtc(date, time, timezone);
            if (!at) return setError('Choose a date and a time.');
            if (at.getTime() <= Date.now()) return setError('Choose a time in the future.');
            setError(null);
            onConfirm(at.toISOString());
          }}
        >
          <DialogHeader>
            <DialogTitle>Schedule publishing</DialogTitle>
            <DialogDescription>
              The page goes on the website at this time, without anyone needing to be online. Times
              are in {zoneLabel}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {preview ? `Goes live on ${formatDateTimeLong(preview.toISOString(), timezone)}.` : ''}
          </p>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Scheduling…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Send back" with a note for the author (approval workflow). */
export function SendBackDialog({
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel="Close">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return setError('Say what needs changing.');
            setError(null);
            onConfirm(note.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Send back for changes</DialogTitle>
            <DialogDescription>
              The author sees your note when they open the page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="send-back-note">What needs changing?</Label>
            <Textarea
              id="send-back-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send back'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
