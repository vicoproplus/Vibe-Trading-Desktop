// src/stores/auth.ts — zustand auth store（独立于 agent store）
import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";
import type { LoginResult, UserInfo } from "@/types/user";
import { setUserSessionTokens } from "@/lib/apiUser";

export type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // 毫秒时间戳
  userInfo: UserInfo | null;

  setSession: (r: LoginResult) => void;
  updateUser: (patch: Partial<UserInfo>) => void;
  setUserInfo: (u: UserInfo | null) => void;
  logout: (opts?: { silent?: boolean }) => void;
  setStatus: (s: AuthStatus) => void;
  bootstrap: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
}

// 确保 persist rehydrate 后 token 同步给 apiUser
const storageAdapter: PersistStorage<{
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  userInfo: UserInfo | null;
}> = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

const onRehydrateCallback = (
  state:
    | { token?: string | null; refreshToken?: string | null; setStatus?: (s: AuthStatus) => void }
    | undefined
) => {
  if (state?.token) {
    setUserSessionTokens(state.token, state.refreshToken ?? null);
  } else if (state?.setStatus) {
    state.setStatus("guest");
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "loading",
      token: null,
      refreshToken: null,
      expiresAt: null,
      userInfo: null,

      setSession: (r) => {
        const now = Date.now();
        setUserSessionTokens(r.token, r.refreshToken); // 同步给 apiUser
        set({
          token: r.token,
          refreshToken: r.refreshToken,
          expiresAt: now + r.expire * 1000,
          status: "authenticated",
        });
      },

      updateUser: (patch) =>
        set((s) => (s.userInfo ? { userInfo: { ...s.userInfo, ...patch } } : {})),

      setUserInfo: (u) => set({ userInfo: u }),

      logout: (opts) => {
        setUserSessionTokens(null, null);
        set({ token: null, refreshToken: null, expiresAt: null, userInfo: null, status: "guest" });
        if (!opts?.silent) {
          // UI 层负责跳转与 toast；store 保持纯净
        }
      },

      setStatus: (s) => set({ status: s }),

      fetchUserInfo: async () => {
        // 动态 import 避免模块顶层循环依赖
        const { apiUser } = await import("@/lib/apiUser");
        const u = await apiUser.getPerson();
        set({ userInfo: u });
      },

      bootstrap: async () => {
        const { apiUser } = await import("@/lib/apiUser");
        const state = get();
        if (!state.token || (state.expiresAt && state.expiresAt < Date.now())) {
          if (!state.token) {
            setUserSessionTokens(null, null);
            set({ status: "guest" });
            return;
          }
        }
        try {
          const u = await apiUser.getPerson();
          set({ userInfo: u, status: "authenticated" });
        } catch {
          // getPerson 内部已尝试 refresh（apiUser 401 机制）；仍失败则登出
          get().logout({ silent: true });
        }
      },
    }),
    {
      name: "vibe_trading_auth",
      storage: storageAdapter,
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        userInfo: s.userInfo,
      }),
      onRehydrateStorage: () => onRehydrateCallback,
    }
  )
);
