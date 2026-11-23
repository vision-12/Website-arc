import {
  DM_Sans,
  Inter,
  Libre_Baskerville,
  Lora,
  Merriweather,
  Nunito_Sans,
  Playfair_Display,
  Source_Serif_4,
} from 'next/font/google';
import type { FontKey } from './keys';

// Self-hosted at build time by next/font. `preload: false`: only the families a school's theme
// actually references are downloaded by the browser. At most two weights per family (MP §10).
// next/font requires literal options at every call site (no spreading of shared objects).
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '600'],
  variable: '--font-inter',
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '600'],
  variable: '--font-source-serif-4',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '700'],
  variable: '--font-playfair-display',
});
const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '600'],
  variable: '--font-lora',
});
const nunito = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '700'],
  variable: '--font-nunito-sans',
});
const merriweather = Merriweather({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '700'],
  variable: '--font-merriweather',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '600'],
  variable: '--font-dm-sans',
});
const baskerville = Libre_Baskerville({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
});

const families: Record<FontKey, { variable: string }> = {
  inter,
  'source-serif-4': sourceSerif,
  'playfair-display': playfair,
  lora,
  'nunito-sans': nunito,
  merriweather,
  'dm-sans': dmSans,
  'libre-baskerville': baskerville,
};

/** Class names that define every allow-listed font variable; applied once on <html>. */
export const fontVariableClassNames = Object.values(families)
  .map((f) => f.variable)
  .join(' ');
