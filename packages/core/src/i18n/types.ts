import type { fr } from './fr';

export type Dictionary = typeof fr;

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

/** Every dotted path that resolves to a string. */
export type MessageKey<T = Dictionary, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Join<P, K>
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? MessageKey<T[K], Join<P, K>>
        : never;
}[keyof T & string];

/** Paths that resolve to a list of strings. */
export type ListKey<T = Dictionary, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends readonly string[]
    ? Join<P, K>
    : T[K] extends string
      ? never
      : T[K] extends object
        ? ListKey<T[K], Join<P, K>>
        : never;
}[keyof T & string];

/** Paths to `{ one, other }` plural objects. */
export type PluralKey<T = Dictionary, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends { one: string; other: string }
    ? Join<P, K>
    : T[K] extends string | readonly unknown[]
      ? never
      : T[K] extends object
        ? PluralKey<T[K], Join<P, K>>
        : never;
}[keyof T & string];

export type Vars = Record<string, string | number | null | undefined>;
