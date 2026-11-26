import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { inspectUpload, pdfProblem } from '../processing';
import { MESSAGES, uploadProblem } from '../schema';

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } });

const PLAIN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
  'latin1',
);

describe('inspectUpload: the server check of every upload (ADR-018)', () => {
  it('strips all metadata, including camera and location data', async () => {
    const input = await photo(400, 300)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Taken at 0.3476 N, 32.5825 E', Make: 'PhoneCo' } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const r = await inspectUpload(input, 'image/jpeg');
    if (!r.ok || r.kind !== 'image') throw new Error('expected an accepted photo');
    expect((await sharp(r.bytes).metadata()).exif).toBeUndefined();
  });

  it('turns sideways phone photos upright', async () => {
    const input = await photo(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const r = await inspectUpload(input, 'image/jpeg');
    if (!r.ok || r.kind !== 'image') throw new Error('expected an accepted photo');
    expect([r.width, r.height]).toEqual([100, 200]);
  });

  it('shrinks large photos to a 2,560 px long edge and makes a small blurred placeholder', async () => {
    const r = await inspectUpload(await photo(4000, 3000).png().toBuffer(), 'image/png');
    if (!r.ok || r.kind !== 'image') throw new Error('expected an accepted photo');
    expect([r.width, r.height]).toEqual([2560, 1920]);
    expect(r.lqip).toMatch(/^data:image\/webp;base64,/);
    expect(r.lqip.length).toBeLessThanOrEqual(1500);
  });

  it('trusts the bytes, not the name: a PNG called .jpg is stored as a PNG', async () => {
    const r = await inspectUpload(await photo(50, 50).png().toBuffer(), 'image/jpeg');
    expect(r).toMatchObject({ ok: true, mime: 'image/png', ext: 'png' });
  });

  it('refuses a program renamed as a photo, an SVG, and a photo uploaded as a PDF', async () => {
    const exe = Buffer.concat([
      Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'),
      Buffer.alloc(512),
    ]);
    expect(await inspectUpload(exe, 'image/png')).toMatchObject({ ok: false });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(await inspectUpload(svg, 'image/png')).toEqual({
      ok: false,
      reason: MESSAGES.wrongType,
    });
    const png = await photo(20, 20).png().toBuffer();
    expect(await inspectUpload(png, 'application/pdf')).toEqual({
      ok: false,
      reason: MESSAGES.notWhatItSays,
    });
  });

  it('accepts a plain PDF and refuses one with scripts or attachments', async () => {
    expect(await inspectUpload(PLAIN_PDF, 'application/pdf')).toMatchObject({
      ok: true,
      kind: 'document',
    });
    const withScript = Buffer.concat([
      PLAIN_PDF,
      Buffer.from('3 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj', 'latin1'),
    ]);
    expect(await inspectUpload(withScript, 'application/pdf')).toEqual({
      ok: false,
      reason: MESSAGES.activePdf,
    });
    expect(pdfProblem(Buffer.from('<< /Type /EmbeddedFile >>', 'latin1'))).toBe(MESSAGES.activePdf);
  });

  it('reports a damaged photo in plain words', async () => {
    const truncated = (await photo(300, 300).jpeg().toBuffer()).subarray(0, 120);
    expect(await inspectUpload(truncated, 'image/jpeg')).toEqual({
      ok: false,
      reason: MESSAGES.unreadable,
    });
  });
});

describe('uploadProblem: the same rules in the browser, before anything is sent (MP §11)', () => {
  it('explains size limits with the actual numbers', () => {
    expect(uploadProblem({ name: 'big.jpg', size: 18 * 1024 * 1024, type: 'image/jpeg' })).toBe(
      'This file is 18 MB. The limit is 10 MB. Try a smaller photo.',
    );
    expect(
      uploadProblem({ name: 'big.pdf', size: 25 * 1024 * 1024, type: 'application/pdf' }),
    ).toBe('This file is 25 MB. The limit is 20 MB. Try saving the PDF at a smaller size.');
  });

  it('names the problem for SVG, HEIC and other types', () => {
    expect(uploadProblem({ name: 'logo.svg', size: 10, type: 'image/svg+xml' })).toBe(MESSAGES.svg);
    expect(uploadProblem({ name: 'IMG_1.HEIC', size: 10, type: '' })).toBe(MESSAGES.heic);
    expect(uploadProblem({ name: 'notes.docx', size: 10, type: 'application/msword' })).toBe(
      MESSAGES.wrongType,
    );
    expect(uploadProblem({ name: 'ok.png', size: 10, type: 'image/png' })).toBeNull();
  });
});
