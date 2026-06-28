// frontend/src/lib/telemetry/__tests__/db.test.ts
import { openDB, putEvent, getBucketsBefore, deleteBucket, purgeOld, metaGet, metaSet } from "../db";

beforeEach(async () => {
  const req = indexedDB.deleteDatabase("vibe_telemetry");
  await new Promise<void>((res) => { req.onsuccess = () => res(); req.onerror = () => res(); });
});

it("putEvent 写入后按 date 分桶查询", async () => {
  await putEvent({ ts: 1, type: "page_view", props: { route: "/a" }, date: "2026-06-26" });
  await putEvent({ ts: 2, type: "page_view", props: { route: "/b" }, date: "2026-06-26" });
  await putEvent({ ts: 3, type: "page_view", props: { route: "/c" }, date: "2026-06-27" });
  const buckets = await getBucketsBefore("2026-06-28");
  expect(Object.keys(buckets).sort()).toEqual(["2026-06-26", "2026-06-27"]);
  expect(buckets["2026-06-26"]).toHaveLength(2);
});

it("getBucketsBefore 不含当天及之后", async () => {
  await putEvent({ ts: 1, type: "session_start", props: {}, date: "2026-06-27" });
  await putEvent({ ts: 2, type: "session_start", props: {}, date: "2026-06-28" });
  const buckets = await getBucketsBefore("2026-06-28");
  expect(buckets["2026-06-27"]).toBeDefined();
  expect(buckets["2026-06-28"]).toBeUndefined();
});

it("deleteBucket 删除指定日期", async () => {
  await putEvent({ ts: 1, type: "page_view", props: {}, date: "2026-06-26" });
  await deleteBucket("2026-06-26");
  const buckets = await getBucketsBefore("2026-06-28");
  expect(buckets["2026-06-26"]).toBeUndefined();
});

it("purgeOld 丢弃超期桶并返回计数", async () => {
  await putEvent({ ts: 1, type: "page_view", props: {}, date: "2026-06-13" });
  await putEvent({ ts: 2, type: "page_view", props: {}, date: "2026-06-12" });
  await putEvent({ ts: 3, type: "page_view", props: {}, date: "2026-06-27" });
  const n = await purgeOld(14, () => "2026-06-28");
  expect(n).toBe(2);
  const buckets = await getBucketsBefore("2026-06-28");
  expect(buckets["2026-06-12"]).toBeUndefined();
  expect(buckets["2026-06-13"]).toBeUndefined();
  expect(buckets["2026-06-27"]).toBeDefined();
});

it("meta get/set kv", async () => {
  await metaSet("foo", { a: 1 });
  const v = await metaGet<{ a: number }>("foo");
  expect(v).toEqual({ a: 1 });
});
