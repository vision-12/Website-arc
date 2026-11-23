import { enGB, type Messages } from './en-GB';

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string
  ? never
  : { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type MessageKey = Paths<Messages>;

const catalogues = { 'en-GB': enGB } as const;
export type Locale = keyof typeof catalogues;

/** Typed message lookup. Unknown keys are a compile error. */
export function t(key: MessageKey, locale: Locale = 'en-GB'): string {
  let node: unknown = catalogues[locale];
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  if (typeof node !== 'string') throw new Error(`Missing message: ${key}`);
  return node;
}
