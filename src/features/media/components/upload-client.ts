import {
  confirmMediaReplace,
  confirmMediaUpload,
  requestMediaReplace,
  requestMediaUpload,
} from '../actions';
import {
  isUploadType,
  MAX_LONG_EDGE,
  MESSAGES,
  uploadProblem,
  type MediaItem,
  type UploadType,
} from '../schema';

/**
 * Browser side of an upload (MP §11, spec §4.2): photos are converted and shrunk on the device
 * (saving the school's data bundle), then sent straight to Storage through a signed URL with real
 * progress. File bytes never pass through a Vercel Function (CLAUDE.md).
 */

export type UploadStage = 'preparing' | 'uploading' | 'checking' | 'done' | 'error';

export class UploadError extends Error {}

const isHeic = (f: File) => /^image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function needsShrinking(file: File): Promise<boolean> {
  if (file.size > 3 * 1024 * 1024) return true;
  try {
    const bitmap = await createImageBitmap(file);
    const big = Math.max(bitmap.width, bitmap.height) > MAX_LONG_EDGE;
    bitmap.close();
    return big;
  } catch {
    return false;
  }
}

/** iPhone HEIC → JPEG; large photos → 2,560 px long edge. Libraries load only when needed. */
export async function prepareFile(file: File): Promise<File> {
  let out = file;
  if (isHeic(out)) {
    try {
      const { heicTo } = await import('heic-to/csp');
      const jpeg = await heicTo({ blob: out, type: 'image/jpeg', quality: 0.9 });
      out = new File([jpeg], out.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
    } catch {
      throw new UploadError(MESSAGES.heic);
    }
  }
  if (SHRINKABLE.has(out.type) && (await needsShrinking(out))) {
    const { default: imageCompression } = await import('browser-image-compression');
    const smaller = await imageCompression(out, {
      maxWidthOrHeight: MAX_LONG_EDGE,
      maxSizeMB: 9,
      // The worker build loads its script from a CDN, which the CSP blocks; one photo at a time is fine.
      useWebWorker: false,
      initialQuality: 0.85,
      fileType: out.type,
      preserveExif: false,
    });
    out = new File([smaller], out.name, { type: out.type });
  }
  return out;
}

/** PUT to a signed upload URL with progress (fetch can't report upload progress). */
export function putFile(
  url: string,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError('The upload was refused. Please try again.'));
    };
    xhr.onerror = () =>
      reject(new UploadError('The upload stopped. Check your connection and try again.'));
    xhr.send(file);
  });
}

type OnStage = (stage: UploadStage, progress?: number) => void;

async function prepared(original: File, onStage: OnStage): Promise<File & { type: UploadType }> {
  onStage('preparing');
  const file = await prepareFile(original);
  const problem = uploadProblem(file);
  if (problem || !isUploadType(file.type)) throw new UploadError(problem ?? MESSAGES.wrongType);
  return file as File & { type: UploadType };
}

export async function uploadToLibrary(original: File, onStage: OnStage): Promise<MediaItem> {
  const file = await prepared(original, onStage);
  const req = await requestMediaUpload({ filename: file.name, mime: file.type, size: file.size });
  if (!req.ok) throw new UploadError(req.error.fieldErrors?.size?.[0] ?? req.error.message);
  onStage('uploading', 0);
  await putFile(req.data.signedUrl, file, (p) => onStage('uploading', p));
  onStage('checking');
  const done = await confirmMediaUpload({ assetId: req.data.assetId });
  if (!done.ok) throw new UploadError(done.error.message);
  onStage('done');
  return done.data;
}

/** Replace in place: the item keeps its id, so every page that uses it shows the new file. */
export async function replaceInLibrary(
  item: MediaItem,
  original: File,
  onStage: OnStage,
): Promise<MediaItem> {
  const file = await prepared(original, onStage);
  const req = await requestMediaReplace({
    id: item.id,
    filename: file.name,
    mime: file.type,
    size: file.size,
  });
  if (!req.ok) throw new UploadError(req.error.message);
  onStage('uploading', 0);
  await putFile(req.data.signedUrl, file, (p) => onStage('uploading', p));
  onStage('checking');
  const done = await confirmMediaReplace({
    id: item.id,
    version: item.version,
    path: req.data.path,
    filename: file.name,
  });
  if (!done.ok) throw new UploadError(done.error.message);
  onStage('done');
  return done.data;
}

export const uploadErrorMessage = (e: unknown) =>
  e instanceof UploadError ? e.message : 'Something went wrong with this upload. Please try again.';
