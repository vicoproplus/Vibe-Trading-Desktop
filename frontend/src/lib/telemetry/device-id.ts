// frontend/src/lib/telemetry/device-id.ts
const KEY = "vibe_device_id";
let _cache: string | null = null;

/** UUID v4（无 crypto.randomUUID 时的回退）。 */
function uuidv4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  (crypto as any).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0,4).join("")}-${h.slice(4,6).join("")}-${h.slice(6,8).join("")}-${h.slice(8,10).join("")}-${h.slice(10,16).join("")}`;
}

export function getDeviceId(): string {
  if (_cache) return _cache;
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* 隐私模式忽略 */ }
  if (!id) {
    id = uuidv4();
    try { localStorage.setItem(KEY, id); } catch { /* 隐私模式：仅内存 */ }
  }
  _cache = id;
  return id;
}

export function resetDeviceIdForTest(): void { _cache = null; }
