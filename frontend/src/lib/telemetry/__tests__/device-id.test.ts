// frontend/src/lib/telemetry/__tests__/device-id.test.ts
import { getDeviceId, resetDeviceIdForTest } from "../device-id";

beforeEach(() => {
  localStorage.clear();
  resetDeviceIdForTest();
});

it("首次生成 UUID 形态", () => {
  const id = getDeviceId();
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it("复用同一值（持久）", () => {
  const a = getDeviceId();
  const b = getDeviceId();
  expect(b).toBe(a);
  expect(localStorage.getItem("vibe_device_id")).toBe(a);
});
