// src/stores/__tests__/auth.test.ts
import { useAuthStore } from "../auth";
import { apiUser } from "@/lib/apiUser";
import type { UserInfo } from "@/types/user";

const userFixture = (): UserInfo => ({
  id: 7, gender: 1, status: 1, loginType: 2, nickName: "Neo", phone: "13800000000",
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useAuthStore.getState().logout({ silent: true });
});

// === Task 6: auth store basic ===

describe("auth store — initial state", () => {
  it("is guest with no tokens", () => {
    const s = useAuthStore.getState();
    // After logout in beforeEach, status should be guest
    expect(s.token).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.userInfo).toBeNull();
    expect(s.status).toBe("guest");
  });
});

describe("setSession", () => {
  it("stores tokens, sets expiresAt, and status=authenticated", () => {
    useAuthStore.getState().setSession({
      token: "t", refreshToken: "rt", expire: 3600, refreshExpire: 7200,
    });
    const s = useAuthStore.getState();
    expect(s.token).toBe("t");
    expect(s.refreshToken).toBe("rt");
    expect(s.expiresAt).toBeGreaterThan(0);
    expect(s.status).toBe("authenticated");
  });
});

describe("logout", () => {
  it("clears everything and sets guest", () => {
    useAuthStore.getState().setSession({ token: "t", refreshToken: "rt", expire: 1, refreshExpire: 2 });
    useAuthStore.getState().logout({ silent: true });
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.userInfo).toBeNull();
    expect(s.status).toBe("guest");
  });
});

describe("persist", () => {
  it("persists token/userInfo to localStorage and restores", async () => {
    useAuthStore.getState().setSession({ token: "t", refreshToken: "rt", expire: 1, refreshExpire: 2 });
    useAuthStore.getState().setUserInfo({ id: 7, gender: 0, status: 1, loginType: 2, nickName: "Neo" });
    // zustand persist 写 localStorage（key = vibe_trading_auth）
    const raw = localStorage.getItem("vibe_trading_auth");
    expect(raw).toBeTruthy();
    expect(raw!).toContain("t");
    expect(raw!).toContain("Neo");
  });
});

// === Task 7: bootstrap & fetchUserInfo ===

describe("auth store — bootstrap & fetchUserInfo", () => {
  it("bootstrap sets guest when no token", async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe("guest");
  });

  it("bootstrap fetches person and sets authenticated when token present", async () => {
    useAuthStore.getState().setSession({ token: "t", refreshToken: "rt", expire: 3600, refreshExpire: 7200 });
    const spy = vi.spyOn(apiUser, "getPerson").mockResolvedValue(userFixture());
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().userInfo?.nickName).toBe("Neo");
    expect(useAuthStore.getState().status).toBe("authenticated");
    spy.mockRestore();
  });

  it("bootstrap logs out when getPerson throws", async () => {
    useAuthStore.getState().setSession({ token: "t", refreshToken: "rt", expire: 3600, refreshExpire: 7200 });
    const spy = vi.spyOn(apiUser, "getPerson").mockRejectedValue(new Error("401"));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe("guest");
    expect(useAuthStore.getState().token).toBeNull();
    spy.mockRestore();
  });

  it("fetchUserInfo updates store", async () => {
    useAuthStore.getState().setSession({ token: "t", refreshToken: "rt", expire: 3600, refreshExpire: 7200 });
    const spy = vi.spyOn(apiUser, "getPerson").mockResolvedValue(userFixture());
    await useAuthStore.getState().fetchUserInfo();
    expect(useAuthStore.getState().userInfo?.id).toBe(7);
    spy.mockRestore();
  });
});
