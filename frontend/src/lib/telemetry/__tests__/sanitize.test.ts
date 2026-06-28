// frontend/src/lib/telemetry/__tests__/sanitize.test.ts
import { sanitize, hashStack } from "../sanitize";

it("白名单外 type 被丢弃", () => {
  expect(sanitize({ type: "free_text_event", props: {} })).toEqual({ ok: false });
});

it("feature_use 非法 name 被丢弃", () => {
  expect(sanitize({ type: "feature_use", name: "leak_prompt", props: {} })).toEqual({ ok: false });
});

it("禁用属性被剔除（含敏感字段）", () => {
  const r = sanitize({
    type: "page_view",
    props: { route: "/agent", prompt: "买入茅台", symbol: "600519", amount: 10000 },
  });
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.event.props).toEqual({ route: "/agent" });
    expect(r.event.props).not.toHaveProperty("prompt");
    expect(r.event.props).not.toHaveProperty("symbol");
  }
});

it("session_end 仅保留 duration_ms", () => {
  const r = sanitize({ type: "session_end", props: { duration_ms: 12345, extra: "x" } });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.event.props).toEqual({ duration_ms: 12345 });
});

it("hashStack 稳定且不含原栈文本", () => {
  const h1 = hashStack("TypeError: at foo\n at bar");
  const h2 = hashStack("TypeError: at foo\n at bar");
  expect(h1).toBe(h2);
  expect(h1).toMatch(/^[0-9a-f]{8}$/);
  expect(h1).not.toContain("TypeError");
});
