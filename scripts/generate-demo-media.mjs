#!/usr/bin/env node
/**
 * Generates the LOCAL demo images (Phase 3, decision P3-B: placeholders until real photographs).
 * Flat, earthy scenes with light grain, never glowing gradients, so layouts can be judged without
 * stock photos. Writes:
 *   supabase/seed/media/<folder>/<id>.webp   (uploaded to the local `media` bucket by the CLI)
 *   supabase/seed/demo-media.sql              (matching media_assets rows: size, alt, blur preview)
 *   src/features/templates/shared/demo/media.ts (typed manifest for the demo gallery fixtures)
 * Deterministic: same input, same files. Run: node scripts/generate-demo-media.mjs
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = '0d3e0000-0000-4000-8000-000000000000';
const id = (n) => `0d3e0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const PALETTES = {
  sand: {
    sky: '#e9e2d4',
    far: '#d4c7ae',
    mid: '#b99c74',
    dark: '#7b5b3b',
    deep: '#4a3523',
    lawn: '#9aa070',
  },
  clay: {
    sky: '#eddcd0',
    far: '#d8b59c',
    mid: '#ba7d5b',
    dark: '#8b4f36',
    deep: '#4f2b1e',
    lawn: '#8f9a68',
  },
  sage: {
    sky: '#e2e7dd',
    far: '#bdc8b1',
    mid: '#889b77',
    dark: '#57674b',
    deep: '#2f3a2b',
    lawn: '#7f9160',
  },
  slate: {
    sky: '#e0e5e9',
    far: '#bac4cc',
    mid: '#8897a4',
    dark: '#4f5d6a',
    deep: '#2c3641',
    lawn: '#8a9670',
  },
  ochre: {
    sky: '#f0e6ce',
    far: '#ddc690',
    mid: '#c29b53',
    dark: '#876730',
    deep: '#4d3b1d',
    lawn: '#94985f',
  },
};

const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" ${extra}/>`;

/** Small deterministic pseudo-random sequence (so builds are reproducible). */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const SCENES = {
  building(w, h, p) {
    const out = [rect(0, 0, w, h, p.sky), rect(0, h * 0.6, w, h * 0.4, p.far)];
    for (const x of [0.02, 0.07, 0.9, 0.96])
      out.push(circle(w * x, h * 0.55, h * 0.13, p.dark, 'opacity="0.85"'));
    out.push(
      rect(w * 0.12, h * 0.31, w * 0.76, h * 0.4, p.mid),
      rect(w * 0.1, h * 0.28, w * 0.8, h * 0.035, p.dark),
    );
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 10; col++) {
        const x = w * (0.15 + col * 0.072);
        if (col === 4 || col === 5) continue;
        out.push(rect(x, h * (0.36 + row * 0.15), w * 0.04, h * 0.09, p.deep, 'opacity="0.6"'));
      }
    out.push(rect(w * 0.465, h * 0.5, w * 0.07, h * 0.21, p.deep));
    out.push(rect(0, h * 0.71, w, h * 0.29, p.lawn));
    out.push(
      `<polygon points="${w * 0.47},${h * 0.71} ${w * 0.53},${h * 0.71} ${w * 0.62},${h} ${w * 0.38},${h}" fill="${p.sky}" opacity="0.55"/>`,
    );
    return out.join('');
  },
  arch(w, h, p) {
    const x0 = w * 0.34;
    const x1 = w * 0.66;
    const r = (x1 - x0) / 2;
    const top = h * 0.22 + r;
    const out = [rect(0, 0, w, h, p.mid)];
    for (let i = 0; i < 14; i++)
      out.push(rect(0, h * (i * 0.075), w, 1.5, p.dark, 'opacity="0.25"'));
    out.push(
      rect(x0 - w * 0.05, h * 0.18, w * 0.05, h * 0.82, p.dark),
      rect(x1, h * 0.18, w * 0.05, h * 0.82, p.dark),
    );
    out.push(
      `<path d="M${x0},${h} L${x0},${top} A${r},${r} 0 0 1 ${x1},${top} L${x1},${h} Z" fill="${p.deep}"/>`,
    );
    const inset = r * 0.16;
    out.push(
      `<path d="M${x0 + inset},${h} L${x0 + inset},${top} A${r - inset},${r - inset} 0 0 1 ${x1 - inset},${top} L${x1 - inset},${h} Z" fill="${p.sky}" opacity="0.4"/>`,
    );
    out.push(rect(0, h * 0.88, w, h * 0.12, p.dark));
    return out.join('');
  },
  field(w, h, p) {
    const horizon = h * 0.46;
    const out = [rect(0, 0, w, h, p.sky)];
    const next = rng(7);
    for (let x = -0.02; x < 1.04; x += 0.045)
      out.push(circle(w * x, horizon, h * (0.05 + next() * 0.05), p.dark, 'opacity="0.9"'));
    out.push(rect(0, horizon, w, h - horizon, p.lawn));
    for (let i = 0; i < 8; i += 2) {
      const a = i / 8;
      const b = (i + 1) / 8;
      out.push(
        `<polygon points="${w * (0.5 + (a - 0.5) * 0.35)},${horizon} ${w * (0.5 + (b - 0.5) * 0.35)},${horizon} ${w * (0.5 + (b - 0.5) * 2.2)},${h} ${w * (0.5 + (a - 0.5) * 2.2)},${h}" fill="#ffffff" opacity="0.07"/>`,
      );
    }
    out.push(
      `<path d="M${w * 0.38},${horizon + h * 0.02} L${w * 0.62},${horizon + h * 0.02} L${w * 0.7},${horizon + h * 0.14} L${w * 0.3},${horizon + h * 0.14} Z" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="${Math.max(2, w * 0.002)}"/>`,
    );
    out.push(
      rect(
        w * 0.46,
        horizon - h * 0.04,
        w * 0.08,
        h * 0.045,
        'none',
        `stroke="#ffffff" stroke-opacity="0.8" stroke-width="${Math.max(2, w * 0.002)}"`,
      ),
    );
    return out.join('');
  },
  board(w, h, p) {
    const out = [rect(0, 0, w, h, p.sky)];
    out.push(
      rect(w * 0.08, h * 0.16, w * 0.6, h * 0.38, p.dark),
      rect(w * 0.095, h * 0.18, w * 0.57, h * 0.34, '#2f4a3d'),
    );
    for (let i = 0; i < 4; i++)
      out.push(
        rect(
          w * 0.13,
          h * (0.24 + i * 0.065),
          w * (0.38 - i * 0.06),
          Math.max(2, h * 0.006),
          '#ffffff',
          'opacity="0.35"',
        ),
      );
    out.push(
      rect(w * 0.74, h * 0.1, w * 0.2, h * 0.46, '#f6f1e6'),
      rect(w * 0.835, h * 0.1, w * 0.01, h * 0.46, p.dark),
      rect(w * 0.74, h * 0.32, w * 0.2, h * 0.01, p.dark),
    );
    out.push(rect(0, h * 0.62, w, h * 0.38, p.far));
    for (let row = 0; row < 3; row++) {
      const y = h * (0.66 + row * 0.11);
      const inset = (2 - row) * 0.05;
      for (let col = 0; col < 3; col++)
        out.push(
          rect(
            w * (0.06 + inset + col * (0.3 - inset * 0.3)),
            y,
            w * (0.24 - inset * 0.3),
            h * 0.05,
            p.mid,
          ),
        );
    }
    return out.join('');
  },
  shelves(w, h, p) {
    const out = [rect(0, 0, w, h, p.deep)];
    const colours = [p.mid, p.far, p.sky, p.dark, '#5d6d7b', '#9a5c44', '#c8b27a'];
    const next = rng(31);
    for (let shelf = 0; shelf < 4; shelf++) {
      const base = h * (0.24 + shelf * 0.24);
      let x = w * 0.04;
      while (x < w * 0.95) {
        const bw = w * (0.012 + next() * 0.02);
        const bh = h * (0.12 + next() * 0.07);
        out.push(rect(x, base - bh, bw, bh, colours[Math.floor(next() * colours.length)]));
        x += bw + w * 0.003;
      }
      out.push(rect(0, base, w, h * 0.02, p.dark));
    }
    return out.join('');
  },
  portrait(w, h, p) {
    return [
      rect(0, 0, w, h, p.sky),
      circle(w * 0.62, h * 0.3, Math.min(w, h) * 0.42, p.far, 'opacity="0.55"'),
      `<ellipse cx="${w * 0.5}" cy="${h * 1.04}" rx="${w * 0.44}" ry="${h * 0.4}" fill="${p.deep}"/>`,
      rect(w * 0.44, h * 0.55, w * 0.12, h * 0.16, p.dark),
      `<ellipse cx="${w * 0.5}" cy="${h * 0.43}" rx="${w * 0.17}" ry="${h * 0.2}" fill="${p.mid}"/>`,
    ].join('');
  },
  lab(w, h, p) {
    const out = [rect(0, 0, w, h, p.sky)];
    for (let i = 1; i < 5; i++)
      out.push(rect(w * (i * 0.2), 0, Math.max(3, w * 0.006), h * 0.62, p.far));
    out.push(rect(0, h * 0.3, w, Math.max(3, h * 0.008), p.far));
    out.push(rect(0, h * 0.62, w, h * 0.38, p.dark), rect(0, h * 0.62, w, h * 0.03, p.deep));
    const flasks = [
      [0.2, '#a7bdb3'],
      [0.36, '#cfa86b'],
      [0.55, '#bf8e7c'],
      [0.72, '#a7bdb3'],
    ];
    for (const [x, colour] of flasks) {
      out.push(
        rect(
          w * (x - 0.012),
          h * 0.4,
          w * 0.024,
          h * 0.12,
          '#f7f3ea',
          `stroke="${p.deep}" stroke-width="3"`,
        ),
      );
      out.push(circle(w * x, h * 0.56, h * 0.07, colour, `stroke="${p.deep}" stroke-width="3"`));
    }
    return out.join('');
  },
  trees(w, h, p) {
    const out = [rect(0, 0, w, h, p.sky), rect(0, h * 0.66, w, h * 0.34, p.lawn)];
    out.push(
      `<polygon points="${w * 0.45},${h * 0.66} ${w * 0.55},${h * 0.66} ${w * 0.8},${h} ${w * 0.2},${h}" fill="${p.far}"/>`,
    );
    const next = rng(11);
    for (const x of [0.08, 0.24, 0.76, 0.92]) {
      out.push(rect(w * (x - 0.012), h * 0.36, w * 0.024, h * 0.34, p.deep));
      for (let i = 0; i < 4; i++)
        out.push(
          circle(
            w * (x + (next() - 0.5) * 0.1),
            h * (0.24 + next() * 0.14),
            h * (0.1 + next() * 0.06),
            i % 2 ? '#5a6b4d' : '#6e7e5c',
          ),
        );
    }
    return out.join('');
  },
  assembly(w, h, p) {
    const out = [
      rect(0, 0, w, h, p.sky),
      rect(0, 0, w, h * 0.26, p.dark),
      rect(w * 0.3, h * 0.2, w * 0.4, h * 0.06, p.mid),
    ];
    for (let row = 0; row < 6; row++) {
      const y = h * (0.42 + row * 0.1);
      const r = h * (0.022 + row * 0.006);
      const count = 16 - row;
      for (let i = 0; i < count; i++)
        out.push(circle(w * ((i + 0.5) / count), y, r, row % 2 ? p.deep : p.dark));
    }
    return out.join('');
  },
};

function svg(scene, w, h, p, seed) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer>
    </filter>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${SCENES[scene](w, h, p)}
  <rect width="${w}" height="${h}" fill="url(#light)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
</svg>`;
}

/** Each demo image: where it appears, what a real photograph there would show (its alt text). */
const IMAGES = [
  [
    'hero-main',
    'building',
    'sand',
    2400,
    1350,
    'The main teaching block seen across the front lawn',
  ],
  ['hero-library', 'arch', 'clay', 2400, 1350, 'The arched entrance to the school library'],
  ['hero-sport', 'field', 'sage', 2400, 1350, 'The main sports field on a weekday afternoon'],
  ['intro', 'board', 'slate', 1200, 1500, 'A senior two mathematics lesson'],
  ['head-teacher', 'portrait', 'ochre', 1200, 1500, 'The head teacher in her office'],
  ['parent-1', 'portrait', 'sage', 600, 600, ''],
  ['parent-2', 'portrait', 'clay', 600, 600, ''],
  ['parent-3', 'portrait', 'slate', 600, 600, ''],
  ['level-o', 'board', 'sand', 1600, 1067, 'Students at their desks in an O-level classroom'],
  ['level-a', 'lab', 'slate', 1600, 1067, 'A chemistry practical in the science laboratory'],
  ['level-library', 'shelves', 'clay', 1600, 1067, 'Shelves in the school library'],
  ['gallery-1', 'assembly', 'ochre', 1600, 1600, 'Morning assembly in the main hall'],
  ['gallery-2', 'trees', 'sage', 1600, 1067, 'The shaded walk between the dormitories'],
  ['gallery-3', 'field', 'ochre', 1600, 1067, 'An inter-house football match'],
  ['gallery-4', 'arch', 'slate', 1600, 1067, 'The chapel doorway'],
  ['gallery-5', 'shelves', 'sand', 1600, 1067, 'The reading corner in the junior library'],
  ['news-1', 'field', 'clay', 1600, 1067, 'The athletics team at the district championships'],
  ['news-2', 'lab', 'sand', 1600, 1067, 'Students presenting a science fair project'],
  ['news-3', 'assembly', 'sage', 1600, 1067, 'Parents at the term one open day'],
];

const outDir = join(root, 'supabase/seed/media');
await rm(outDir, { recursive: true, force: true });
await mkdir(join(outDir, FOLDER), { recursive: true });

const manifest = {};
const rows = [];
for (const [index, [key, scene, palette, w, h, alt]] of IMAGES.entries()) {
  const mediaId = id(index + 1);
  const path = `${FOLDER}/${mediaId}.webp`;
  const image = sharp(Buffer.from(svg(scene, w, h, PALETTES[palette], index + 3)));
  const file = await image.clone().webp({ quality: 74, effort: 6 }).toBuffer();
  await writeFile(join(outDir, path), file);
  const tiny = await image.clone().resize(16).webp({ quality: 40 }).toBuffer();
  const lqip = `data:image/webp;base64,${tiny.toString('base64')}`;
  manifest[key] = { id: mediaId, path, width: w, height: h, alt, lqip };
  rows.push(
    `('${mediaId}', 'image', 'media', '${path}', '${key}.webp', 'image/webp', ${file.length}, ${w}, ${h}, ${alt ? `'${alt.replaceAll("'", "''")}'` : 'null'}, '${lqip}')`,
  );
  console.log(`${key.padEnd(14)} ${w}x${h}  ${(file.length / 1024).toFixed(0)} KB`);
}

await writeFile(
  join(root, 'supabase/seed/demo-media.sql'),
  `-- LOCAL DEMO ONLY. Generated by scripts/generate-demo-media.mjs; do not edit by hand.
-- Placeholder images until real photographs (Phase 3, P3-B); the files are seeded into the
-- local media bucket from supabase/seed/media by the CLI.
insert into public.media_assets (id, kind, bucket, path, original_filename, mime_type, size_bytes, width, height, alt_text, lqip) values
${rows.join(',\n')};
`,
);

const manifestPath = join(root, 'src/features/templates/shared/demo/media.ts');
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(
  manifestPath,
  `// Generated by scripts/generate-demo-media.mjs; do not edit by hand.
/** The local demo images (placeholders), keyed by where they appear. */
export const DEMO_MEDIA = ${JSON.stringify(manifest, null, 2)} as const;

export type DemoMediaKey = keyof typeof DEMO_MEDIA;
`,
);
console.log(
  `\n${IMAGES.length} images → supabase/seed/media, demo-media.sql, shared/demo/media.ts`,
);
