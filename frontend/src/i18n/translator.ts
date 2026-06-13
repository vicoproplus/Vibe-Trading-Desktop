import type { NestedKeyOf, Vars } from "./types";

/** Read a dot-path value from an object. Returns undefined on any missing/non-object segment. */
export function get(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Replace {{name}} placeholders in `s` using `vars`. Unknown placeholders are left intact. */
export function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

export interface Translator<T> {
  t: (path: NestedKeyOf<T>, vars?: Vars) => string;
}

/**
 * Build a `t(path, vars?)` bound to `dict`. Missing/non-string keys return the
 * path itself; in dev mode a warning is logged. Pure — no React dependency.
 */
export function createTranslator<T extends object>(dict: T): Translator<T> {
  const t = (path: NestedKeyOf<T>, vars?: Vars): string => {
    const val = get(dict, path as string);
    if (typeof val !== "string") {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] missing translation key: "${path}"`);
      }
      return path as string;
    }
    const out = interpolate(val, vars);
    if (import.meta.env.DEV && /\{\{\s*\w+\s*\}\}/.test(out)) {
      console.warn(`[i18n] unresolved placeholder in "${path}": ${out}`);
    }
    return out;
  };
  return { t };
}
