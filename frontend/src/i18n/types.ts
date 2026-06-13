export type Lang = "zh" | "en";

export const LANGS: readonly Lang[] = ["zh", "en"] as const;
export const DEFAULT_LANG: Lang = "zh";
export const LANG_STORAGE_KEY = "vibe-lang";

/**
 * Recursively build a dot-notation union of leaf string paths in T.
 * { a: { b: "x" } } => "a.b"
 */
export type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? `${K}`
        : T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : never;
    }[keyof T & string]
  : never;

/** Variables used for {{name}} interpolation. */
export type Vars = Record<string, string | number>;
