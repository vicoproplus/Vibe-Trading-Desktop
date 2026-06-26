// src/stores/auth.ts — zustand auth store（独立于 agent store）
import { create } from "zustand";
import { persist } from "zustand/middleware";
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

const initialState: AuthState = {
  status: "loading",
  token: null,
  refreshToken: null,
  expiresAt: null,
  userInfo: null,
  setSession: () => {},
  updateUser: () => {},
  setUserInfo: () => {},
  logout: () => {},
  setStatus: () => {},
  bootstrap: async () => {},
  fetchUserInfo: async () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSession: (r: LoginResult) => {
        const now = Date.now();
        setUserSessionTokens(r.token, r.refreshToken);
        set({
          token: r.token,
          refreshToken: r.refreshToken,
          expiresAt: now + r.expire * 1000,
          status: "authenticated",
        });
      },

      updateUser: (patch: Partial<UserInfo>) =>
        set((s) => (s.userInfo ? { userInfo: { ...s.userInfo, ...patch } } : {})),

      setUserInfo: (u: UserInfo | null) => set({ userInfo: u }),

      logout: (opts?: { silent?: boolean }) => {
        setUserSessionTokens(null, null);
        set({ token: null, refreshToken: null, expiresAt: null, userInfo: null, status: "guest" });

        // 退出后恢复 LLM 为本地默认配置，清除 VIP token
        import("@/lib/api").then(({ api }) =>
          api.updateLLMSettings({
            provider: "openai",
            model_name: "gpt-4o",
            base_url: "",
            clear_api_key: true,
            temperature: 0.7,
            timeout_seconds: 120,
            max_retries: 2,
            reasoning_effort: "",
          }).catch(() => { /* 静默：后端可能未就绪 */ })
        );

        if (!opts?.silent) {
          // UI 层负责跳转与 toast；store 保持纯净
        }
      },

      setStatus: (s: AuthStatus) => set({ status: s }),

      fetchUserInfo: async () => {
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
          get().logout({ silent: true });
        }
      },
    }),
    {
      name: "vibe_trading_auth",
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        userInfo: s.userInfo,
      }),
      onRehydrateStorage: () => {
        return (state?: AuthState) => {
          if (state?.token) {
            setUserSessionTokens(state.token, state.refreshToken);
          }
        };
      },
    }
  )
);
