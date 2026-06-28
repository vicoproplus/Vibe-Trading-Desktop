// frontend/src/lib/telemetry/consent.ts
import { metaSet } from "./db";

const LS_KEY = "vibe_telemetry_consent";
let _cache: boolean | null = null;

export function getConsent(): boolean {
  if (_cache !== null) return _cache;
  let v: boolean | null = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw !== null) v = raw === "1";
  } catch { /* 隐私模式忽略 */ }
  // 默认开启
  const on = v === null ? true : v;
  _cache = on;
  return on;
}

export function isTelemetryEnabled(): boolean {
  return getConsent();
}

export async function setConsent(on: boolean): Promise<void> {
  _cache = on;
  try { localStorage.setItem(LS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  // meta 双写镜像（异步落盘；失败不阻塞 UI）
  try { await metaSet("consent", on); } catch { /* ignore */ }
}

export function resetConsentForTest(): void { _cache = null; }
