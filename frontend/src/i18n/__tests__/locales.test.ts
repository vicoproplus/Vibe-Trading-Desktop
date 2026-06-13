import { zh } from "../locales/zh";
import { en } from "../locales/en";

/** Collect every dot-path of string leaves in a nested dict. */
function leafPaths(obj: unknown, prefix = ""): string[] {
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return prefix ? [prefix] : [];
}

function walk(a: unknown, b: unknown, path: string): string[] {
  const diffs: string[] = [];
  if (b && typeof b === "object") {
    if (!a || typeof a !== "object") diffs.push(path);
    else
      for (const k of Object.keys(b as object))
        diffs.push(...walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return diffs;
}

describe("locales", () => {
  it("zh has only string leaves", () => {
    for (const p of leafPaths(zh)) {
      const val = p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], zh);
      expect(typeof val).toBe("string");
    }
  });

  it("en has exactly the same key set as zh", () => {
    const missing = walk(en, zh, "");
    expect(missing, `en is missing keys: ${missing.join(", ")}`).toEqual([]);
    const extra = walk(zh, en, "");
    expect(extra, `en has extra keys: ${extra.join(", ")}`).toEqual([]);
  });

  it("no empty translation values", () => {
    for (const p of leafPaths(zh)) {
      const v = (p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], zh) as string).trim();
      expect(v.length).toBeGreaterThan(0);
    }
    for (const p of leafPaths(en)) {
      const v = (p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en) as string).trim();
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
