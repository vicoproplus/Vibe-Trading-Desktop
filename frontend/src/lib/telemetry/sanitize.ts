// frontend/src/lib/telemetry/sanitize.ts
import { ALLOWED_PROPS, EVENT_TYPES, FEATURE_NAMES, type EventType, type TelemetryEvent } from "./types";

export function hashStack(stack: string): string {
  // FNV-1a 32bit；截断防止过长栈消耗算力，且输出仅 hash 不含原文
  const s = (stack ?? "").slice(0, 2000);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

type Result = { ok: true; event: TelemetryEvent } | { ok: false };

export function sanitize(input: {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
}): Result {
  const type = input.type;
  if (!EVENT_TYPES.includes(type as EventType)) return { ok: false };
  if (type === "feature_use") {
    if (!input.name || !FEATURE_NAMES.includes(input.name as never)) return { ok: false };
  }
  const allowed = ALLOWED_PROPS[type as EventType];
  const props: Record<string, number | string> = {};
  const src = input.props ?? {};
  for (const key of allowed) {
    if (key in src) {
      const v = src[key];
      // 仅允许 number/string 枚举值；任何对象/数组/自由文本经白名单本就不在内
      if (typeof v === "number" || typeof v === "string") props[key] = v;
    }
  }
  const event: TelemetryEvent = {
    ts: Math.floor(Date.now() / 1000),
    type: type as EventType,
    props,
  };
  if (type === "feature_use") event.name = input.name;
  return { ok: true, event };
}
