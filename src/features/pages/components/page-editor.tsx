'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SaveStateIndicator } from '@/components/shared/save-state-indicator';
import { StatusBadge } from '@/components/shared/status-badge';
import { toast } from '@/components/ui/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import type { Result } from '@/lib/actions/result';
import { formatDateTimeLong, formatDateTimeShort } from '@/lib/dates/zoned';
import type { TiptapDoc } from '@/lib/rich-text/schema';
import {
  ConflictDialog,
  OtherEditorsNotice,
  RemoteChangeNotice,
  ReviewNoteCallout,
  ScheduleDialog,
  SendBackDialog,
  StaleCopyNotice,
  UnsavedCopyNotice,
} from '@/features/content/components/editor-notices';
import { RichTextEditor } from '@/features/content/components/rich-text-editor';
import { useAutosave, type SaveOutcome } from '@/features/content/components/use-autosave';
import type { ContentStatus, EditorAction } from '@/features/content/lifecycle';
import type { OtherEditor, ReviewNote } from '@/features/content/schema';
import type { WorkingCopy } from '@/features/content/service';
import { slugify } from '@/features/content/slug';
import { MediaPicker } from '@/features/media/components/media-picker';
import { MediaThumb } from '@/features/media/components/media-thumb';
import type { MediaItem } from '@/features/media/schema';
import {
  autosavePage,
  createPagePreview,
  discardPageChanges,
  pageEditorStatus,
  publishPage,
  restorePage,
  savePage,
  schedulePage,
  sendPageBack,
  submitPageForReview,
  trashPage,
  unpublishPage,
} from '../actions';
import { PAGE_LAYOUTS, PageValues, type PageLayout } from '../schema';

export interface PageEditorProps {
  page: {
    id: string;
    version: number;
    status: ContentStatus;
    publishAt: string | null;
    publishedAt: string | null;
    updatedAt: string;
    path: string;
    systemKey: string | null;
    deleted: boolean;
  };
  values: PageValues;
  copy: WorkingCopy<PageValues> | null;
  editors: OtherEditor[];
  reviewNote: ReviewNote | null;
  lastEditedBy: string | null;
  actions: EditorAction[];
  canEdit: boolean;
  parents: Array<{ id: string; title: string; path: string; depth: number }>;
  media: Record<string, MediaItem>;
  timezone: string;
  siteHost: string;
  canUpload: boolean;
  canDescribe: boolean;
  /** Server clock at render: keeps the first render pure; the poll updates it. */
  renderedAt: number;
}

const LAYOUT_LABEL: Record<PageLayout, string> = {
  default: 'Standard',
  wide: 'Wide (for tables and large photos)',
  with_sidebar: 'With a side menu of the section’s pages',
};

const SUCCESS: Partial<Record<EditorAction, string>> = {
  saveDraft: 'Draft saved',
  saveScheduled: 'Changes saved',
  publish: 'Published to the website',
  publishChanges: 'Changes published to the website',
  schedule: 'Scheduled',
  submitForReview: 'Sent for approval',
  sendBack: 'Sent back to the author',
  unpublish: 'Hidden from the website',
  cancelSchedule: 'Schedule cancelled',
};

const POLL_MS = 30_000;

type FieldErrors = Partial<Record<keyof PageValues | 'publishAt', string>>;

function fieldErrorsOf(raw: Record<string, string[]> | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(raw ?? {})) {
    const field = key.replace(/^values\./, '').split('.')[0] as keyof FieldErrors;
    out[field] ??= messages[0] ?? 'Please check this field.';
  }
  return out;
}

const merge = (base: PageValues, copy: WorkingCopy<PageValues> | null): PageValues => {
  if (!copy) return base;
  const v = Object.fromEntries(Object.entries(copy.values).filter(([, x]) => x !== undefined));
  return { ...base, ...v, seo: { ...base.seo, ...(copy.values.seo ?? {}) } };
};

/** The page editor (spec §5.4 `/admin/pages/[id]`, MP §5, §11). */
export function PageEditor(props: PageEditorProps) {
  const { page, timezone } = props;
  const router = useRouter();
  const hydrated = useHydrated();
  const live = page.status === 'published';
  const editable = props.canEdit && !page.deleted;

  const [values, setValues] = useState<PageValues>(() =>
    props.copy && !props.copy.stale ? merge(props.values, props.copy) : props.values,
  );
  const [media, setMedia] = useState(props.media);
  const [staleCopy, setStaleCopy] = useState(props.copy?.stale ? props.copy : null);
  const keptCopy = props.copy && !props.copy.stale ? props.copy : null;
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [editors, setEditors] = useState(props.editors);
  const [now, setNow] = useState(props.renderedAt);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState(false);
  // Tiptap reads its content once; replacing the body from outside (Show my changes) remounts it.
  const [bodyKey, setBodyKey] = useState(0);
  const [dialog, setDialog] = useState<'schedule' | 'sendBack' | 'cover' | null>(null);
  const [busy, setBusy] = useState<EditorAction | 'discard' | 'preview' | null>(null);
  const [, start] = useTransition();
  const slugTouched = useRef(
    page.publishedAt !== null || props.values.slug !== slugify(props.values.title),
  );
  const baseVersion = useRef(page.version);
  const summaryRef = useRef<HTMLDivElement>(null);

  const autosave = useAutosave<PageValues>(async (snapshot, { force }): Promise<SaveOutcome> => {
    const r = await autosavePage({
      id: page.id,
      baseVersion: baseVersion.current,
      data: snapshot,
      ...(force ? { force } : {}),
    });
    if (!r.ok) return 'failed';
    setEditors(r.data.editors);
    if (r.data.stale) setRemoteChanged(true);
    return r.data.savedAt === null ? 'retry' : 'saved';
  });

  useEffect(() => {
    if (!editable) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      void pageEditorStatus({ id: page.id }).then((r) => {
        if (!r.ok) return;
        setEditors(r.data.editors);
        if (r.data.version > baseVersion.current) setRemoteChanged(true);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [editable, page.id]);

  const update = (patch: Partial<PageValues>) => {
    setValues((current) => {
      const next = { ...current, ...patch };
      autosave.changed(next);
      return next;
    });
  };

  const setTitle = (title: string) =>
    update(slugTouched.current ? { title } : { title, slug: slugify(title) || values.slug });

  const addMedia = (item: MediaItem) => setMedia((m) => ({ ...m, [item.id]: item }));

  async function run(action: EditorAction, extra: { publishAt?: string; note?: string } = {}) {
    const applies = [
      'saveDraft',
      'saveScheduled',
      'publish',
      'publishChanges',
      'schedule',
      'submitForReview',
    ].includes(action);
    let checked: PageValues | null = null;
    if (applies) {
      const parsed = PageValues.safeParse(values);
      if (!parsed.success) {
        setErrors(
          fieldErrorsOf(
            Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), [i.message]])),
          ),
        );
        summaryRef.current?.focus();
        return;
      }
      checked = parsed.data;
    }
    setErrors({});
    setBusy(action);
    await autosave.settle();
    const ref = { id: page.id, version: baseVersion.current };
    let r: Result<unknown>;
    if (checked && action === 'schedule')
      r = await schedulePage({ ...ref, values: checked, publishAt: extra.publishAt ?? '' });
    else if (checked && action === 'submitForReview')
      r = await submitPageForReview({ ...ref, values: checked });
    else if (checked && (action === 'publish' || action === 'publishChanges'))
      r = await publishPage({ ...ref, values: checked });
    else if (checked) r = await savePage({ ...ref, values: checked });
    else if (action === 'sendBack') r = await sendPageBack({ ...ref, note: extra.note ?? '' });
    else if (action === 'unpublish' || action === 'cancelSchedule') r = await unpublishPage(ref);
    else if (action === 'trash') r = await trashPage(ref);
    else if (action === 'restore') r = await restorePage({ id: page.id });
    else
      r = {
        ok: false,
        error: { code: 'VALIDATION', message: 'That action isn’t available here.' },
      };
    setBusy(null);
    setDialog(null);

    if (!r.ok) {
      autosave.resume();
      if (r.error.code === 'CONFLICT') return setConflict(true);
      const fe = fieldErrorsOf(r.error.fieldErrors);
      if (Object.keys(fe).length) setErrors(fe);
      toast.error('Not done', r.error.message);
      return;
    }
    if (applies) autosave.markSaved();
    else autosave.resume();
    if (action === 'trash') {
      toast.success('Moved to Trash', 'You can restore it from Trash for 30 days.');
      return router.push('/admin/pages');
    }
    if (action === 'restore') toast.success('Restored from Trash');
    else if (SUCCESS[action]) toast.success(SUCCESS[action]);
    router.refresh();
  }

  async function preview() {
    // Open the tab now (inside the click, so it isn't blocked), then send it to the preview.
    const tab = window.open('about:blank', '_blank');
    setBusy('preview');
    if (editable) {
      autosave.changed(values);
      await autosave.flush(true);
    }
    const r = await createPagePreview({ id: page.id });
    setBusy(null);
    if (!r.ok) {
      tab?.close();
      return toast.error('The preview could not be opened', r.error.message);
    }
    if (tab) tab.location.href = r.data.url;
    else window.location.assign(r.data.url);
  }

  const discard = () =>
    start(async () => {
      setBusy('discard');
      const r = await discardPageChanges({ id: page.id });
      setBusy(null);
      if (!r.ok) return toast.error('Not discarded', r.error.message);
      autosave.markSaved();
      toast.success('Changes discarded');
      window.location.reload();
    });

  const errorList = Object.entries(errors);
  const has = (a: EditorAction) => props.actions.includes(a);
  const disabled = !hydrated || busy !== null;
  const cover = values.coverMediaId ? media[values.coverMediaId] : undefined;
  const parentPath = props.parents.find((p) => p.id === values.parentId)?.path ?? '';

  const statusLine = page.deleted
    ? 'This page is in Trash.'
    : page.status === 'scheduled' && page.publishAt
      ? `Goes live on ${formatDateTimeLong(page.publishAt, timezone)}.`
      : page.status === 'published' && page.publishedAt
        ? `On the website since ${formatDateTimeShort(page.publishedAt, timezone)}.`
        : page.status === 'in_review'
          ? 'Waiting for someone to approve it.'
          : 'Not on the website yet.';

  return (
    <div className="space-y-4">
      <ConflictDialog open={conflict} onOpenChange={setConflict} />
      {remoteChanged ? <RemoteChangeNotice /> : null}
      <OtherEditorsNotice editors={editors} now={now} />
      {staleCopy ? (
        <StaleCopyNotice
          savedAt={staleCopy.savedAt}
          now={now}
          busy={busy !== null}
          onShow={() => {
            const shown = merge(props.values, staleCopy);
            setValues(shown);
            setBodyKey((k) => k + 1);
            setStaleCopy(null);
            autosave.changed(shown);
          }}
          onDiscard={discard}
        />
      ) : null}
      {keptCopy ? (
        <UnsavedCopyNotice
          live={live}
          savedAt={keptCopy.savedAt}
          now={now}
          busy={busy !== null}
          onDiscard={discard}
        />
      ) : null}
      {props.reviewNote && page.status === 'draft' ? (
        <ReviewNoteCallout note={props.reviewNote} timezone={timezone} />
      ) : null}
      {!props.canEdit && !page.deleted ? (
        <p className="rounded-lg border bg-card p-4 text-sm">
          You can look at this page, but not change it.
        </p>
      ) : null}

      <div
        ref={summaryRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className={
          errorList.length ? 'rounded-lg border border-destructive bg-card p-4' : 'sr-only'
        }
      >
        {errorList.length ? (
          <>
            <p className="font-semibold">
              Please check {errorList.length === 1 ? 'one thing' : `${errorList.length} things`}:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a href={`#page-${field}`} className="underline underline-offset-4">
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="page-title">Page title</Label>
            <Input
              id="page-title"
              value={values.title}
              disabled={!editable}
              maxLength={150}
              className="h-12 text-lg font-semibold"
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              {...(errors.title ? { 'aria-describedby': 'page-title-error' } : {})}
            />
            {errors.title ? (
              <p id="page-title-error" className="text-sm font-medium text-destructive">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="page-slug">Web address</Label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:border-ring">
              <span
                className="flex items-center bg-muted px-3 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                {props.siteHost}
                {parentPath}/
              </span>
              <input
                id="page-slug"
                value={values.slug}
                disabled={!editable || page.systemKey !== null}
                maxLength={120}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none md:text-sm"
                onChange={(e) => {
                  slugTouched.current = true;
                  update({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') });
                }}
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={`page-slug-hint${errors.slug ? ' page-slug-error' : ''}`}
              />
            </div>
            <p id="page-slug-hint" className="text-sm text-muted-foreground">
              {page.systemKey
                ? 'Built-in pages keep their address.'
                : page.publishedAt
                  ? 'Changing the address of a published page keeps the old address working: visitors are sent to the new one.'
                  : 'Made from the title. Lower-case letters, numbers and hyphens.'}
            </p>
            {errors.slug ? (
              <p id="page-slug-error" className="text-sm font-medium text-destructive">
                {errors.slug}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5" id="page-body">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" id="page-body-label">
                Page text
              </span>
              {/* On phones the Status card is below the editor: show the save state here too. */}
              {editable ? (
                <SaveStateIndicator state={autosave.state} announce={false} className="lg:hidden" />
              ) : null}
            </div>
            <RichTextEditor
              key={bodyKey}
              value={values.body}
              onChange={(body: TiptapDoc) => update({ body })}
              media={media}
              onMediaAdded={addMedia}
              editable={editable}
              label="Page text"
              canUpload={props.canUpload}
              canDescribe={props.canDescribe}
            />
            {errors.body ? (
              <p className="text-sm font-medium text-destructive">{errors.body}</p>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4" aria-label="Publishing and settings">
          <section
            aria-labelledby="status-heading"
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="status-heading" className="text-sm font-semibold">
                Status
              </h2>
              <StatusBadge status={page.status} />
            </div>
            <p className="text-sm">{statusLine}</p>
            {editable ? <SaveStateIndicator state={autosave.state} /> : null}
            {props.lastEditedBy ? (
              <p className="text-xs text-muted-foreground">
                Last saved by {props.lastEditedBy}, {formatDateTimeShort(page.updatedAt, timezone)}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {has('publish') ? (
                <Button disabled={disabled} onClick={() => void run('publish')}>
                  {busy === 'publish'
                    ? 'Publishing…'
                    : page.status === 'scheduled'
                      ? 'Publish now'
                      : 'Publish to website'}
                </Button>
              ) : null}
              {has('publishChanges') ? (
                <Button disabled={disabled} onClick={() => void run('publishChanges')}>
                  {busy === 'publishChanges' ? 'Publishing…' : 'Publish changes'}
                </Button>
              ) : null}
              {has('submitForReview') ? (
                <Button disabled={disabled} onClick={() => void run('submitForReview')}>
                  {busy === 'submitForReview' ? 'Sending…' : 'Submit for approval'}
                </Button>
              ) : null}
              {has('saveDraft') ? (
                <Button variant="outline" disabled={disabled} onClick={() => void run('saveDraft')}>
                  {busy === 'saveDraft' ? 'Saving…' : 'Save draft'}
                </Button>
              ) : null}
              {has('saveScheduled') ? (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void run('saveScheduled')}
                >
                  {busy === 'saveScheduled' ? 'Saving…' : 'Save changes'}
                </Button>
              ) : null}
              {has('schedule') ? (
                <Button variant="outline" disabled={disabled} onClick={() => setDialog('schedule')}>
                  {page.status === 'scheduled' ? 'Change the time…' : 'Schedule…'}
                </Button>
              ) : null}
              {has('sendBack') ? (
                <Button variant="outline" disabled={disabled} onClick={() => setDialog('sendBack')}>
                  Send back…
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={!hydrated || busy === 'preview'}
                onClick={() => void preview()}
              >
                <Eye aria-hidden="true" />
                {busy === 'preview' ? 'Opening…' : 'Preview'}
                <span className="sr-only">(opens in a new tab)</span>
              </Button>
              {has('unpublish') ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={disabled}>
                      Hide from website
                    </Button>
                  }
                  title={`Hide ‘${values.title}’ from the website?`}
                  description="Visitors will no longer see it. You can publish it again at any time."
                  confirmLabel="Hide from website"
                  onConfirm={() => run('unpublish')}
                />
              ) : null}
              {has('cancelSchedule') ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={disabled}>
                      Cancel schedule
                    </Button>
                  }
                  title={`Cancel the schedule for ‘${values.title}’?`}
                  description="It stays a draft and won’t go on the website by itself."
                  confirmLabel="Cancel schedule"
                  onConfirm={() => run('cancelSchedule')}
                />
              ) : null}
              {has('restore') ? (
                <Button disabled={disabled} onClick={() => void run('restore')}>
                  Restore from Trash
                </Button>
              ) : null}
            </div>
          </section>

          <section
            aria-labelledby="settings-heading"
            className="space-y-4 rounded-lg border bg-card p-4"
          >
            <h2 id="settings-heading" className="text-sm font-semibold">
              Page settings
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="page-parentId">Where it sits</Label>
              <NativeSelect
                id="page-parentId"
                value={values.parentId ?? ''}
                disabled={!editable || page.systemKey !== null}
                onChange={(e) => update({ parentId: e.target.value || null })}
                aria-describedby="page-parent-hint"
              >
                <option value="">At the top level</option>
                {props.parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {'— '.repeat(p.depth)}Inside “{p.title}”
                  </option>
                ))}
              </NativeSelect>
              <p id="page-parent-hint" className="text-sm text-muted-foreground">
                Pages can sit inside other pages, up to three levels deep.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-layout">Layout</Label>
              <NativeSelect
                id="page-layout"
                value={values.layout}
                disabled={!editable}
                onChange={(e) => update({ layout: e.target.value as PageLayout })}
              >
                {PAGE_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {LAYOUT_LABEL[l]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="page-showInNav"
                checked={values.showInNav}
                disabled={!editable}
                onChange={(e) => update({ showInNav: e.target.checked })}
              />
              <Label htmlFor="page-showInNav" className="leading-snug">
                Show in its section’s side menu
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-excerpt">Summary (optional)</Label>
              <Textarea
                id="page-excerpt"
                value={values.excerpt}
                disabled={!editable}
                maxLength={300}
                rows={3}
                onChange={(e) => update({ excerpt: e.target.value })}
                aria-describedby="page-excerpt-hint"
              />
              <p id="page-excerpt-hint" className="text-sm text-muted-foreground">
                Shown in search results and when the page is shared. {values.excerpt.length}/300
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium" id="cover-label">
                Cover photo (optional)
              </span>
              {cover ? (
                <div className="space-y-2">
                  <MediaThumb item={cover} className="aspect-video rounded-lg" />
                  <p className="text-xs text-muted-foreground">“{cover.altText}”</p>
                </div>
              ) : null}
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setDialog('cover')}
                  >
                    <ImagePlus aria-hidden="true" />
                    {cover ? 'Change cover photo' : 'Choose a cover photo'}
                  </Button>
                  {cover ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update({ coverMediaId: null })}
                    >
                      <X aria-hidden="true" />
                      Remove cover
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <details className="group rounded-lg border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              How this page looks on Google
            </summary>
            <div className="mt-4 space-y-4">
              <div className="rounded-md border p-3" aria-label="Google preview">
                <p className="truncate text-xs text-muted-foreground">
                  {props.siteHost}
                  {parentPath}/{values.slug}
                </p>
                <p className="truncate text-base text-blue-800">
                  {values.seo.title || values.title}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {values.seo.description ||
                    values.excerpt ||
                    'Google shows text from the page here.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="page-seo-title">Title on Google (optional)</Label>
                <Input
                  id="page-seo-title"
                  value={values.seo.title ?? ''}
                  placeholder={values.title}
                  maxLength={70}
                  disabled={!editable}
                  onChange={(e) => update({ seo: { ...values.seo, title: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="page-seo-description">Description on Google (optional)</Label>
                <Textarea
                  id="page-seo-description"
                  value={values.seo.description ?? ''}
                  maxLength={160}
                  rows={3}
                  disabled={!editable}
                  onChange={(e) => update({ seo: { ...values.seo, description: e.target.value } })}
                />
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="page-seo-noindex"
                  checked={values.seo.noindex ?? false}
                  disabled={!editable}
                  onChange={(e) => update({ seo: { ...values.seo, noindex: e.target.checked } })}
                />
                <Label htmlFor="page-seo-noindex" className="leading-snug">
                  Hide this page from Google
                </Label>
              </div>
            </div>
          </details>

          {props.actions.includes('trash') ? (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="w-full text-destructive" disabled={disabled}>
                  <Trash2 aria-hidden="true" />
                  Move to Trash
                </Button>
              }
              title={`Move ‘${values.title}’ to Trash?`}
              description="This can be undone from Trash for 30 days."
              confirmLabel="Move to Trash"
              destructive
              onConfirm={() => run('trash')}
            />
          ) : null}
        </aside>
      </div>

      <ScheduleDialog
        open={dialog === 'schedule'}
        onOpenChange={(o) => setDialog(o ? 'schedule' : null)}
        timezone={timezone}
        current={page.status === 'scheduled' ? page.publishAt : null}
        busy={busy === 'schedule'}
        onConfirm={(publishAt) => void run('schedule', { publishAt })}
      />
      <SendBackDialog
        open={dialog === 'sendBack'}
        onOpenChange={(o) => setDialog(o ? 'sendBack' : null)}
        busy={busy === 'sendBack'}
        onConfirm={(note) => void run('sendBack', { note })}
      />
      <MediaPicker
        open={dialog === 'cover'}
        onOpenChange={(o) => setDialog(o ? 'cover' : null)}
        kind="image"
        canUpload={props.canUpload}
        canDescribe={props.canDescribe}
        onSelect={(item) => {
          addMedia(item);
          update({ coverMediaId: item.id });
        }}
      />
    </div>
  );
}
