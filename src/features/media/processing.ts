import 'server-only';
import { fileTypeFromBuffer } from 'file-type';
import sharp, { type OutputInfo, type Sharp } from 'sharp';
import {
  EXTENSION,
  isUploadType,
  kindOf,
  MAX_LONG_EDGE,
  MESSAGES,
  type UploadType,
} from './schema';

/**
 * The server's check of an uploaded file (spec §4.2 confirmUpload; plan P4-G; ADR-018). The real
 * type comes from the file's first bytes, never its name. Photos are re-encoded: rotated upright,
 * shrunk to the long-edge limit, and stripped of all metadata (EXIF, including GPS location).
 * PDFs are refused if they carry scripts, attachments or forms (Q13 heuristics; no antivirus in v1).
 */

export type Inspected =
  | {
      ok: true;
      kind: 'image';
      mime: UploadType;
      ext: string;
      bytes: Buffer;
      width: number;
      height: number;
      lqip: string;
    }
  | { ok: true; kind: 'document'; mime: 'application/pdf'; ext: 'pdf'; bytes: Buffer }
  | { ok: false; reason: string };

/** Decompression-bomb guard: a 2560 px photo is ~6 MP; phones produce up to ~50 MP. */
const MAX_INPUT_PIXELS = 80_000_000;

const ACTIVE_PDF =
  /\/(?:JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|OpenAction\s*<<[^>]*\/S\s*\/JavaScript)\b/;

export function pdfProblem(bytes: Uint8Array): string | null {
  return ACTIVE_PDF.test(Buffer.from(bytes).toString('latin1')) ? MESSAGES.activePdf : null;
}

async function encode(image: Sharp, mime: UploadType): Promise<{ data: Buffer; info: OutputInfo }> {
  switch (mime) {
    case 'image/jpeg':
      return image.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    case 'image/png':
      return image.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    case 'image/webp':
      return image.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    case 'image/avif':
      return image.avif({ quality: 55 }).toBuffer({ resolveWithObject: true });
    case 'image/gif':
      return image.gif().toBuffer({ resolveWithObject: true });
    case 'application/pdf':
      throw new Error('not an image');
  }
}

/** A tiny blurred preview shown while the photo loads (stored as a data URI, ≤ 1.5 KB). */
async function placeholder(bytes: Buffer): Promise<string> {
  const tiny = await sharp(bytes, { pages: 1 })
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${tiny.toString('base64')}`;
}

export async function inspectUpload(input: Uint8Array, declared: UploadType): Promise<Inspected> {
  const detected = await fileTypeFromBuffer(input);
  if (!detected) return { ok: false, reason: MESSAGES.wrongType };
  if (/^image\/hei[cf]/.test(detected.mime)) return { ok: false, reason: MESSAGES.heic };
  if (!isUploadType(detected.mime) || kindOf(detected.mime) !== kindOf(declared))
    return { ok: false, reason: MESSAGES.notWhatItSays };

  const mime = detected.mime;
  if (mime === 'application/pdf') {
    const problem = pdfProblem(input);
    return problem
      ? { ok: false, reason: problem }
      : { ok: true, kind: 'document', mime, ext: 'pdf', bytes: Buffer.from(input) };
  }

  try {
    const animated = mime === 'image/gif' || mime === 'image/webp';
    const image = sharp(input, { animated, limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: MAX_LONG_EDGE,
        height: MAX_LONG_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    const { data, info } = await encode(image, mime);
    return {
      ok: true,
      kind: 'image',
      mime,
      ext: EXTENSION[mime],
      bytes: data,
      width: info.width,
      height: info.pageHeight ?? info.height,
      lqip: await placeholder(data),
    };
  } catch {
    return { ok: false, reason: MESSAGES.unreadable };
  }
}
