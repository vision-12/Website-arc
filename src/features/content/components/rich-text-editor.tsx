'use client';
import { createContext, useContext, useId, useMemo, useState } from 'react';
import Image from 'next/image';
import type { JSONContent } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type Editor,
  type NodeViewProps,
} from '@tiptap/react';
import {
  Bold,
  FileText,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
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
import { MediaImage, richTextExtensions } from '@/lib/rich-text/extensions';
import { safeHref } from '@/lib/rich-text/safe-href';
import type { TiptapDoc } from '@/lib/rich-text/schema';
import { cn } from '@/lib/utils';
import { MediaPicker } from '@/features/media/components/media-picker';
import type { MediaItem } from '@/features/media/schema';
import './rich-text-editor.css';

/** Library items the document refers to, for drawing photos inside the editor. */
const MediaRefs = createContext<ReadonlyMap<string, MediaItem>>(new Map());

function ImageNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const refs = useContext(MediaRefs);
  const attrs = node.attrs as { mediaId?: string | null; size?: string };
  const item = attrs.mediaId ? refs.get(attrs.mediaId) : undefined;
  const wide = attrs.size === 'wide';
  return (
    <NodeViewWrapper
      as="figure"
      className={cn(
        'rte-figure my-4 rounded-lg border bg-muted/40 p-2',
        selected && 'outline-3 outline-ring',
      )}
    >
      {item && item.width && item.height ? (
        <Image
          src={item.url}
          alt={item.altText}
          width={item.width}
          height={item.height}
          sizes="(min-width: 1024px) 700px, 90vw"
          className={cn('h-auto rounded', wide ? 'w-full' : 'mx-auto w-full max-w-xl')}
          draggable={false}
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">
          This photo is no longer in the media library. Remove it or choose another.
        </p>
      )}
      <figcaption
        contentEditable={false}
        className="mt-2 flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="min-w-0 flex-1 text-muted-foreground">
          {item ? <>Description: “{item.altText}”</> : null}
        </span>
        {editor.isEditable ? (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={wide}
              onClick={() => updateAttributes({ size: wide ? 'normal' : 'wide' })}
            >
              {wide ? 'Make it normal width' : 'Make it full width'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => deleteNode()}>
              <Trash2 aria-hidden="true" />
              Remove photo
            </Button>
          </>
        ) : null}
      </figcaption>
    </NodeViewWrapper>
  );
}

const EditorImage = MediaImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

function useExtensions(placeholder: string) {
  return useMemo(
    () => [
      ...richTextExtensions.filter((e) => e.name !== 'image'),
      EditorImage,
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );
}

const BLOCKS = [
  { value: 'paragraph', label: 'Normal text' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'h4', label: 'Small heading' },
] as const;

function ToolButton({
  label,
  pressed,
  onClick,
  disabled,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={pressed ? 'secondary' : 'ghost'}
      className="size-11"
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function Toolbar({
  editor,
  onPhoto,
  onPdf,
  onLink,
}: {
  editor: Editor;
  onPhoto: () => void;
  onPdf: () => void;
  onLink: () => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 })
        ? 'h2'
        : e.isActive('heading', { level: 3 })
          ? 'h3'
          : e.isActive('heading', { level: 4 })
            ? 'h4'
            : 'paragraph',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const selectId = useId();
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-1 border-b bg-card p-1"
    >
      <label htmlFor={selectId} className="sr-only">
        Text style
      </label>
      <select
        id={selectId}
        className="h-11 rounded-md border border-input bg-card px-2 text-sm"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          const chain = editor.chain().focus();
          if (v === 'paragraph') chain.setParagraph().run();
          else chain.toggleHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
        }}
      >
        {BLOCKS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <ToolButton
        label="Bold"
        pressed={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Italic"
        pressed={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        pressed={s.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        pressed={s.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Quote"
        pressed={s.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Dividing line"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus aria-hidden="true" />
      </ToolButton>
      <ToolButton label={s.link ? 'Change link' : 'Add a link'} pressed={s.link} onClick={onLink}>
        <Link2 aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Add a photo" onClick={onPhoto}>
        <ImagePlus aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Link to a PDF" onClick={onPdf}>
        <FileText aria-hidden="true" />
      </ToolButton>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <ToolButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!s.undo}
      >
        <Undo2 aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!s.redo}
      >
        <Redo2 aria-hidden="true" />
      </ToolButton>
    </div>
  );
}

function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const [href, setHref] = useState('');
  const [error, setError] = useState<string | null>(null);
  const existing = editor.isActive('link');
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setHref((editor.getAttributes('link') as { href?: string }).href ?? '');
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent closeLabel="Close">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const safe = safeHref(href);
            if (!safe)
              return setError(
                'Type a full web address like https://example.org, or a page on this website like /admissions.',
              );
            const chain = editor.chain().focus().extendMarkRange('link');
            if (editor.state.selection.empty && !existing)
              chain
                .insertContent({
                  type: 'text',
                  text: href,
                  marks: [{ type: 'link', attrs: { href: safe } }],
                })
                .run();
            else chain.setLink({ href: safe }).run();
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{existing ? 'Change link' : 'Add a link'}</DialogTitle>
            <DialogDescription>
              Links open in the same tab. Links to other websites are marked for search engines.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>Web address</Label>
            <Input
              id={id}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://… or /admissions"
              aria-invalid={error ? true : undefined}
              {...(error ? { 'aria-describedby': `${id}-error` } : {})}
            />
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            {existing ? (
              <Button
                variant="outline"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  onOpenChange(false);
                }}
              >
                Remove link
              </Button>
            ) : null}
            <Button type="submit">{existing ? 'Save link' : 'Add link'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface RichTextEditorProps {
  value: TiptapDoc;
  onChange: (doc: TiptapDoc) => void;
  /** Library items already used in the document (photos and PDFs). */
  media: Record<string, MediaItem>;
  onMediaAdded: (item: MediaItem) => void;
  editable: boolean;
  label: string;
  placeholder?: string;
  canUpload: boolean;
  canDescribe: boolean;
  onBlur?: () => void;
}

/**
 * The school rich-text editor (MP §5.9): Tiptap v3 with the shared extension list, so everything
 * written here can be rendered by the public site's static renderer. `immediatelyRender: false`
 * (CLAUDE.md). Photos and PDFs come only from the media library; pasted images are dropped.
 */
export function RichTextEditor({
  value,
  onChange,
  media,
  onMediaAdded,
  editable,
  label,
  placeholder = 'Start writing. Use the toolbar to add headings, lists, links, photos and PDFs.',
  canUpload,
  canDescribe,
  onBlur,
}: RichTextEditorProps) {
  const extensions = useExtensions(placeholder);
  const [picker, setPicker] = useState<'image' | 'document' | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions,
    content: value as JSONContent,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
        class: 'rte-content min-h-80 max-w-none px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as TiptapDoc),
    ...(onBlur ? { onBlur: () => onBlur() } : {}),
  });
  const refs = useMemo(() => new Map(Object.entries(media)), [media]);

  if (!editor)
    return (
      <div className="min-h-96 rounded-lg border bg-card" aria-busy="true" aria-label={label} />
    );

  return (
    <MediaRefs.Provider value={refs}>
      <div className="rounded-lg border bg-card focus-within:border-ring">
        {editable ? (
          <Toolbar
            editor={editor}
            onPhoto={() => setPicker('image')}
            onPdf={() => setPicker('document')}
            onLink={() => setLinkOpen(true)}
          />
        ) : null}
        <EditorContent editor={editor} />
      </div>
      {editable ? (
        <>
          <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
          <MediaPicker
            open={picker !== null}
            onOpenChange={(o) => !o && setPicker(null)}
            kind={picker ?? 'image'}
            canUpload={canUpload}
            canDescribe={canDescribe}
            onSelect={(item) => {
              onMediaAdded(item);
              const chain = editor.chain().focus();
              if (item.kind === 'image') {
                chain
                  .insertContent({ type: 'image', attrs: { mediaId: item.id, size: 'normal' } })
                  .run();
              } else if (editor.state.selection.empty) {
                chain
                  .insertContent({
                    type: 'text',
                    text: item.filename.replace(/\.pdf$/i, ''),
                    marks: [{ type: 'link', attrs: { href: item.url, mediaId: item.id } }],
                  })
                  .run();
              } else {
                chain.setMark('link', { href: item.url, mediaId: item.id }).run();
              }
            }}
          />
        </>
      ) : null}
    </MediaRefs.Provider>
  );
}
