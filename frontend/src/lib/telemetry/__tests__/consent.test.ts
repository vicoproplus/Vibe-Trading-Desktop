// frontend/src/lib/telemetry/__tests__/consent.test.ts
import { getConsent, setConsent, isTelemetryEnabled, resetConsentForTest } from "../consent";

beforeEach(async () => {
  localStorage.clear();
  resetConsentForTest();
  const req = indexedDB.deleteDatabase("vibe_telemetry");
  await new Promise<void>((r) => { req.onsuccess = () => r(); req.onerror = () => r(); });
});

it("默认开启", () => {
  expect(getConsent()).toBe(true);
  expect(isTelemetryEnabled()).toBe(true);
});

it("setConsent(false) 后读取为 false 并写 localStorage 镜像", async () => {
  await setConsent(false);
  expect(getConsent()).toBe(false);
  expect(isTelemetryEnabled()).toBe(false);
  expect(localStorage.getItem("vibe_telemetry_consent")).toBe("0");
});

it("localStorage=0 时即使 meta 未加载也读为 false", () => {
  localStorage.setItem("vibe_telemetry_consent", "0");
  expect(getConsent()).toBe(false);
});
