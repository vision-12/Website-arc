import { z } from 'zod';
import { formatFileSize } from '@/lib/format/file-size';
import { Version } from '@/features/content/schema';

/**
 * Media library rules (MP §5.9, §7.4, §11; plan P4-C, P4-G; ADR-018). Client-safe: the uploader
 * checks files with the same rules before anything is sent, and the actions check again.
 */

export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;
/** Q24: PDF only. Office files belong in the resource centre (Phase 11). */
export const DOCUMENT_TYPES = ['application/pdf'] as const;
export const UPLOAD_TYPES = [...PHOTO_TYPES, ...DOCUMENT_TYPES] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
/** Photos are shrunk to this long edge in the browser (MP §11), and again on the server if needed. */
export const MAX_LONG_EDGE = 2560;
export const PAGE_SIZE = 24;

export const EXTENSION: Record<UploadType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export const MEDIA_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif|gif|pdf)$/;

export const isUploadType = (mime: string): mime is UploadType =>
  (UPLOAD_TYPES as readonly string[]).includes(mime);
export const kindOf = (mime: UploadType): 'image' | 'document' =>
  mime === 'application/pdf' ? 'document' : 'image';

export const MESSAGES = {
  wrongType:
    'This type of file can’t be used. Choose a JPG, PNG, WebP or GIF photo, or a PDF document.',
  svg: 'SVG files can’t be used yet. Please choose a JPG, PNG or WebP picture instead.',
  heic: 'This iPhone photo (HEIC) couldn’t be converted. On the iPhone, choose Settings › Camera › Formats › Most Compatible, or send yourself the photo as a JPG.',
  unreadable:
    'This photo couldn’t be read. It may be damaged. Save it again or choose another photo.',
  notWhatItSays:
    'This file isn’t really the kind of file its name says. Choose a JPG, PNG, WebP or GIF photo, or a PDF document.',
  activePdf:
    'This PDF contains scripts, attachments or interactive parts, which can’t be put on the website. Save or print it again as a plain PDF and try again.',
  missingAlt:
    'Add a photo description first. It is read aloud to blind visitors and helps Google understand the photo.',
} as const;

/** A plain-language problem with a file, or null when it can be uploaded (MP §11). */
export function uploadProblem(file: { name: string; size: number; type: string }): string | null {
  const name = file.name.toLowerCase();
  if (file.type === 'image/svg+xml' || name.endsWith('.svg')) return MESSAGES.svg;
  if (/^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/.test(name)) return MESSAGES.heic;
  if (!isUploadType(file.type)) return MESSAGES.wrongType;
  const isPdf = file.type === 'application/pdf';
  const limit = isPdf ? DOCUMENT_MAX_BYTES : PHOTO_MAX_BYTES;
  if (file.size > limit)
    return `This file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(limit)}. ${
      isPdf ? 'Try saving the PDF at a smaller size.' : 'Try a smaller photo.'
    }`;
  if (file.size <= 0) return MESSAGES.unreadable;
  return null;
}

/** Shown to blind visitors and search engines (MP §11: plain language for "alt text"). */
export const AltText = z.string().trim().max(250, 'Keep the description under 250 characters.');
export const Caption = z.string().trim().max(500, 'Keep the caption under 500 characters.');
const Filename = z.string().trim().min(1).max(200);

export const RequestUploadInput = z
  .object({ filename: Filename, mime: z.enum(UPLOAD_TYPES), size: z.number().int().positive() })
  .superRefine((v, ctx) => {
    const problem = uploadProblem({ name: v.filename, size: v.size, type: v.mime });
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['size'] });
  });

export const ConfirmUploadInput = z.object({ assetId: z.uuid() });

export const UpdateMediaInput = z.object({
  id: z.uuid(),
  version: Version,
  altText: AltText,
  caption: Caption,
});

export const RequestReplaceInput = z.object({
  id: z.uuid(),
  filename: Filename,
  mime: z.enum(UPLOAD_TYPES),
  size: z.number().int().positive(),
});

export const ConfirmReplaceInput = z.object({
  id: z.uuid(),
  version: Version,
  path: z.string().regex(MEDIA_PATH_RE),
  filename: Filename,
});

export const MediaListInput = z.object({
  q: z.string().trim().max(100).optional(),
  kind: z.enum(['image', 'document']).optional(),
  missingAlt: z.boolean().optional(),
  page: z.number().int().min(1).max(1000).default(1),
});
export type MediaListInput = z.input<typeof MediaListInput>;

/** A library item as the admin screens see it. */
export interface MediaItem {
  id: string;
  kind: 'image' | 'document';
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string;
  caption: string;
  lqip: string | null;
  createdAt: string;
  version: number;
  deletedAt: string | null;
}

export interface MediaUsage {
  label: string;
  href: string;
  /** Where on the item: "page text", "cover photo", "Google preview" */
  where: string;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}
