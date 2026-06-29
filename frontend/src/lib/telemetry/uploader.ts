// frontend/src/lib/telemetry/uploader.ts
import { getBucketsBefore, getAllBuckets, deleteBucket, purgeOld, localToday } from "./db";
import { getDeviceId } from "./device-id";
import { fetchSidecarMetrics } from "./metrics";
import type { SidecarMetrics, TelemetryBatch, UploadResponse } from "./types";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) || "0.0.0";

let _backoff = [2_000, 8_000, 30_000];
// cool-admin 路由前缀 = {目录}/{模块}/{文件}（open 免登），故 /open/telemetry/events + @Post('/events')
let _endpoint = `${import.meta.env.VITE_USER_API_BASE ?? ""}/open/telemetry/events/events`;
let _tokenGetter: () => string | null = () => {
  try {
    const raw = localStorage.getItem("vibe_trading_auth");
    return raw ? (JSON.parse(raw).state?.token ?? null) : null;
  } catch {
    return null;
  }
};

export function setUploadEndpoint(url: string): void {
  _endpoint = url;
}

export function __setTokenGetterForTest(fn: () => string | null): void {
  _tokenGetter = fn;
}

export function __setBackoffMsForTest(ms: number[]): void {
  _backoff = ms;
}

async function uploadOnce(batch: TelemetryBatch, token: string | null): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(_endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      try { await res.json() as UploadResponse; } catch { /* ignore parse errors */ }
      return 200;
    }
    return res.status;
  } catch {
    return -1; // network error → retriable sentinel
  }
}

async function uploadBatchWithRetry(batch: TelemetryBatch, token: string | null): Promise<boolean> {
  for (let attempt = 0; attempt <= _backoff.length; attempt++) {
    const status = await uploadOnce(batch, token);
    if (status === 200) return true;
    // 4xx (non-429): poison pill, discard
    if (status >= 400 && status < 500 && status !== 429) return true; // treated as handled
    // 5xx / 429 / network error (-1): backoff retry, max 3 retries
    if (attempt < _backoff.length) {
      await new Promise((r) => setTimeout(r, _backoff[attempt]));
    } else {
      return false; // retain for next startup
    }
  }
  return false;
}

export interface FlushResult {
  /** 成功上传并删除的批次数 */
  uploaded: number;
  /** 上传失败、保留待下次重试的批次数 */
  retained: number;
}

/**
 * 触发上传。
 * - 默认（隔天 flush，§4）：仅上传 date < today 的批次，当天数据不传。
 * - `forceAll: true`：上传所有批次含当天，仅供 Settings 测试按钮手动验证上传通路。
 */
export async function flushNow(opts: { forceAll?: boolean } = {}): Promise<FlushResult> {
  // Purge expired buckets first (>14 days) so they are never uploaded
  await purgeOld(14).catch(() => 0);

  const today = localToday();
  const buckets = opts.forceAll ? await getAllBuckets() : await getBucketsBefore(today);
  const token = _tokenGetter();
  const dates = Object.keys(buckets).sort(); // ascending by date
  let uploaded = 0;
  let retained = 0;
  for (const date of dates) {
    const events = buckets[date];
    if (!events?.length) continue;
    if (!opts.forceAll && date === today) continue; // today's data not uploaded (defense; getBucketsBefore already excluded)
    let sidecarMetrics: SidecarMetrics | null = null;
    try { sidecarMetrics = await fetchSidecarMetrics(); } catch { sidecarMetrics = null; }
    const batch: TelemetryBatch = {
      device_id: getDeviceId(),
      app_version: APP_VERSION,
      batch_date: date,
      events,
      sidecar_metrics: sidecarMetrics ?? {
        since: 0,
        skill_calls: {},
        backtests: { count: 0, total_ms: 0, by_engine: {} },
        errors: { count: 0, by_type: {} },
      },
    };
    const ok = await uploadBatchWithRetry(batch, token).catch(() => false);
    if (ok) {
      await deleteBucket(date);
      uploaded++;
    } else {
      retained++;
    }
  }
  return { uploaded, retained };
}
