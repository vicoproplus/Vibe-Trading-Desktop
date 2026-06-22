# 前端用户功能（登录/注册 + 个人信息）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `Vibe-Trading-Desktop/frontend` 新增 C 端用户登录/注册（手机号+短信验证码，双验证码流程）与个人信息管理（MVP），与现有 trading 功能零耦合。

**Architecture:** 独立的 `auth` zustand store（+ persist）、独立的 `apiUser` fetch 层（走 vite proxy `/user-api` → cool-admin `:8001`，裸 token 鉴权，401 自动刷新）、`RequireAuth` 仅保护 `/profile`（宽松访问控制，trading 页面不受影响）。所有新增文件与 `agent.ts`/`api.ts`/`apiAuth.ts` 不交叉。

**Tech Stack:** React 19、TypeScript(strict)、react-router v7、zustand 5（+ persist）、Tailwind、vitest 4（jsdom + globals）、@testing-library/react、sonner、lucide-react、react-i18next。

**设计依据:** `docs/superpowers/specs/2026-06-22-user-auth-design.md`

**仓库:** 本计划所有路径相对 `Vibe-Trading-Desktop/frontend/`。后端配套见独立计划 `2026-06-22-user-auth-backend-dypns.md`。

---

## 现有代码约定（务必遵循）

- 测试：`src/**/__tests__/*.test.ts(x)`，`vitest run` 单文件：`npx vitest run <path>`。全局 `describe/it/expect`（无需 import）。setup 已注册 `@testing-library/jest-dom` 与 i18n。
- 样式类：复用 `Settings.tsx` 的 `fieldClass`/`labelClass`/`hintClass`（在每个页面文件内各自定义，不抽公共——跟随现有模式）。
- toast：`import { toast } from "sonner"`。
- i18n：组件内 `const { t } = useTranslation()`；非组件用 `import i18n from "@/i18n"` 后 `i18n.t(key)`。
- 路径别名：`@/*` → `./src/*`。
- commit：`git commit -s`（DCO），无 AI 署名。当前分支 `feat/login-server`，直接提交。

## 后端接口契约（已核对源码，cool-admin 统一响应 `{code:1000,data,message}`）

| 方法 | 路径 | 入参 | 返回 `data` |
|---|---|---|---|
| GET | `/app/user/login/captcha` | query `width?,height?,color?` | `{captchaId,data}`(base64 svg) |
| POST | `/app/user/login/smsCode` | body `{phone,captchaId,code}`(code=图形码) | 空 |
| POST | `/app/user/login/phone` | body `{phone,smsCode}` | `{token,refreshToken,expire,refreshExpire}` |
| POST | `/app/user/login/refreshToken` | body `{refreshToken}` | 同上 |
| GET | `/app/user/info/person` | — | `UserInfo` |
| POST | `/app/user/info/updatePerson` | body `{nickName?,avatarUrl?,gender?,description?}` | `UserInfo` |
| POST | `/app/base/comm/upload` | multipart `file` | `{url,...}` |

**鉴权 header：** `Authorization: <token>`（**不带 Bearer**，cool-admin 约定）。

## File Structure

**Create:**
- `src/types/user.ts` — 用户相关 TS 类型
- `src/lib/apiUser.ts` + `src/lib/__tests__/apiUser.test.ts` — 用户后端 API 层
- `src/stores/auth.ts` + `src/stores/__tests__/auth.test.ts` — auth store
- `src/components/auth/RequireAuth.tsx` + `src/components/auth/__tests__/RequireAuth.test.tsx`
- `src/components/layout/UserMenu.tsx` + `src/components/layout/__tests__/UserMenu.test.tsx`
- `src/pages/auth/Login.tsx` + `src/pages/auth/__tests__/Login.test.tsx`
- `src/pages/profile/Profile.tsx` + `src/pages/profile/__tests__/Profile.test.tsx`

**Modify:**
- `vite.config.ts` — 加 `/user-api` proxy
- `src/router.tsx` — 加 `/login`、`/profile`
- `src/main.tsx` — 启动调 `authStore.bootstrap()`
- `src/components/layout/Layout.tsx` — header 接入 `<UserMenu/>`
- `src/i18n/locales/zh-CN.json` + `en.json` — 加 `auth`/`profile`/`userMenu` 命名空间

**循环依赖说明：** `apiUser.ts` 与 `stores/auth.ts` 会互相 import（store 调 `apiUser.login()`；apiUser 在请求体/401 处理中读 `useAuthStore.getState()`）。ES module 下只要互相调用都发生在**函数体内（运行时）**而非模块顶层（加载时），循环 import 是安全的。两者均满足此条件。

---

## Task 1: 类型定义 `src/types/user.ts`

**Files:**
- Create: `src/types/user.ts`

- [ ] **Step 1: 创建类型文件**

```ts
// src/types/user.ts
export interface UserInfo {
  id: number;
  unionid?: string | null;
  avatarUrl?: string | null;
  nickName?: string | null;
  phone?: string | null;
  /** 0 未知 / 1 男 / 2 女 */
  gender: number;
  /** 0 禁用 / 1 正常 / 2 已注销 */
  status: number;
  /** 0 小程序 / 1 公众号 / 2 H5 */
  loginType: number;
  description?: string | null;
  createTime?: string;
  updateTime?: string;
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  expire: number; // 秒
  refreshExpire: number; // 秒
}

export interface Captcha {
  captchaId: string;
  data: string; // base64 svg
}

export type Gender = 0 | 1 | 2;
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc -b --noEmit`
Expected: 无新增错误（仅类型文件，无运行时代码）。

- [ ] **Step 3: Commit**

```bash
git add src/types/user.ts
git commit -s -m "feat(auth): add user types"
```

---

## Task 2: `apiUser` 核心请求 + 响应解包 + 错误

**Files:**
- Create: `src/lib/apiUser.ts`
- Test: `src/lib/__tests__/apiUser.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/__tests__/apiUser.test.ts
import { apiUser, UserApiError } from "../apiUser";

const json = (code: number, data: unknown, message = "") => ({
  status: 200,
  ok: true,
  headers: new Headers({ "content-type": "application/json" }),
  text: () => Promise.resolve(JSON.stringify({ code, data, message })),
});

beforeEach(() => {
  vi.restoreAllMocks();
  // 清掉任何残留 token（auth store persist 可能在 localStorage）
  localStorage.clear();
});

describe("apiUser request — response unwrap", () => {
  it("returns data when code === 1000", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, { token: "t1" }) as any);
    const r = await (apiUser as any).request<{ token: string }>("/x");
    expect(r).toEqual({ token: "t1" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws UserApiError with message when code !== 1000", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(1001, null, "图形验证码错误") as any
    );
    await expect((apiUser as any).request("/x")).rejects.toThrow(UserApiError);
    await expect((apiUser as any).request("/x")).rejects.toThrow("图形验证码错误");
  });

  it("throws on non-ok HTTP", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 500,
      ok: false,
      headers: new Headers(),
      text: () => Promise.resolve(""),
    } as any);
    await expect((apiUser as any).request("/x")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: FAIL — `apiUser` 未定义。

- [ ] **Step 3: 实现 apiUser 核心**

```ts
// src/lib/apiUser.ts
import type { Captcha, LoginResult, UserInfo } from "@/types/user";

const BASE = import.meta.env.VITE_USER_API_BASE || "/user-api";

export class UserApiError extends Error {
  code?: number;
  status?: number;
  constructor(message: string, opts: { code?: number; status?: number } = {}) {
    super(message);
    this.name = "UserApiError";
    this.code = opts.code;
    this.status = opts.status;
  }
}

interface CoolResponse<T> {
  code: number;
  data: T;
  message?: string;
}

/** 读取当前 token（从 auth store，运行时调用，避免加载期循环依赖）。 */
function getToken(): string | null {
  // auth store 在 Task 6 创建；此处动态 import 安全。
  return null; // 占位，Task 3 改为读 useAuthStore.getState().token
}

export interface RequestOptions extends RequestInit {
  /** 内部：跳过 401 自动刷新（refreshToken 自身使用）。 */
  skipAuthRefresh?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRefresh, headers, ...rest } = options;
  const merged: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) merged["Authorization"] = token; // 不带 Bearer
  if (headers) new Headers(headers).forEach((v, k) => (merged[k] = v));

  const res = await fetch(`${BASE}${path}`, { ...rest, headers: merged });

  if (!res.ok) {
    throw new UserApiError(`HTTP ${res.status}`, { status: res.status });
  }
  const text = await res.text();
  const body: CoolResponse<T> = text ? JSON.parse(text) : ({ code: 1000, data: undefined as T });
  if (body.code !== 1000) {
    throw new UserApiError(body.message || `code=${body.code}`, { code: body.code });
  }
  return body.data;
}

export const apiUser = {
  request,
};
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: PASS（3 个用例）。注意 `getToken()` 当前恒返回 null，不影响本 task 测试。

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiUser.ts src/lib/__tests__/apiUser.test.ts
git commit -s -m "feat(auth): add apiUser core with cool-admin response unwrap"
```

---

## Task 3: `apiUser` token 注入 + 业务方法

**Files:**
- Modify: `src/lib/apiUser.ts`
- Test: `src/lib/__tests__/apiUser.test.ts`（追加）

> 前置：Task 6（auth store）尚未建。本 task 让 `getToken` 通过运行时 `require` 读 store；若 store 文件不存在，测试用 `vi.stubGlobal` 或注入。为避免循环依赖卡住，此处直接定义一个模块级 token holder，由 auth store 同步写入，apiUser 读取。

- [ ] **Step 1: 在 apiUser.ts 顶部加 token holder（替换 Task 2 的占位 getToken）**

```ts
// src/lib/apiUser.ts —— 替换 getToken 占位为：
let _token: string | null = null;
let _refreshToken: string | null = null;

/** auth store 在 setSession/logout 时同步调用，供 apiUser 读取。 */
export function setUserSessionTokens(token: string | null, refreshToken: string | null) {
  _token = token;
  _refreshToken = refreshToken;
}
function getToken() {
  return _token;
}
export function __getRefreshTokenForTest() {
  return _refreshToken;
}
```

> 设计取舍：apiUser 不直接 import auth store（避免循环依赖），改为由 store 主动 `setUserSessionTokens` 同步 token。store 仍单向 import apiUser 调接口；apiUser 只持有 token 副本，无反向依赖。`__getRefreshTokenForTest` 仅供 Task 4 测试。

- [ ] **Step 2: 追加业务方法到 `apiUser` 对象**

把 `export const apiUser = { request };` 替换为：

```ts
export const apiUser = {
  request,

  getCaptcha(opts: { width?: number; height?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.width != null) q.set("width", String(opts.width));
    if (opts.height != null) q.set("height", String(opts.height));
    const qs = q.toString();
    return request<Captcha>(`/app/user/login/captcha${qs ? `?${qs}` : ""}`);
  },

  sendSmsCode(phone: string, captchaId: string, code: string) {
    return request<void>("/app/user/login/smsCode", {
      method: "POST",
      body: JSON.stringify({ phone, captchaId, code }),
    });
  },

  loginByPhone(phone: string, smsCode: string) {
    return request<LoginResult>("/app/user/login/phone", {
      method: "POST",
      body: JSON.stringify({ phone, smsCode }),
    });
  },

  refreshToken(refreshToken: string) {
    return request<LoginResult>("/app/user/login/refreshToken", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuthRefresh: true,
    });
  },

  getPerson() {
    return request<UserInfo>("/app/user/info/person");
  },

  updatePerson(body: {
    nickName?: string;
    avatarUrl?: string;
    gender?: number;
    description?: string;
  }) {
    return request<UserInfo>("/app/user/info/updatePerson", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  upload(file: File) {
    // Task 5 实现
    throw new Error("not implemented");
  },
};
```

- [ ] **Step 3: 追加测试**

```ts
// 追加到 src/lib/__tests__/apiUser.test.ts
import { apiUser, setUserSessionTokens } from "../apiUser";

describe("apiUser — token header", () => {
  it("does not send Authorization when no token", async () => {
    setUserSessionTokens(null, null);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, {}) as any);
    await (apiUser as any).request("/x");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends bare token (no Bearer) when token set", async () => {
    setUserSessionTokens("tok-1", "rt-1");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, {}) as any);
    await (apiUser as any).request("/x");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("tok-1");
  });
});

describe("apiUser — methods", () => {
  beforeEach(() => setUserSessionTokens(null, null));

  it("loginByPhone posts phone+smsCode and returns LoginResult", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, { token: "T", refreshToken: "R", expire: 1, refreshExpire: 2 }) as any);
    const r = await apiUser.loginByPhone("13800000000", "1234");
    expect(r.token).toBe("T");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/app/user/login/phone");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ phone: "13800000000", smsCode: "1234" });
  });

  it("getPerson GETs /app/user/info/person", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, { id: 9, gender: 1, status: 1, loginType: 2 }) as any);
    const r = await apiUser.getPerson();
    expect(r.id).toBe(9);
    expect(fetchMock.mock.calls[0][0]).toContain("/app/user/info/person");
  });

  it("updatePerson posts patch and returns updated user", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, { id: 9, nickName: "n", gender: 1, status: 1, loginType: 2 }) as any);
    const r = await apiUser.updatePerson({ nickName: "n" });
    expect(r.nickName).toBe("n");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ nickName: "n" });
  });

  it("getCaptcha returns {captchaId,data}", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(1000, { captchaId: "c1", data: "<svg/>" }) as any);
    const r = await apiUser.getCaptcha();
    expect(r.captchaId).toBe("c1");
  });

  it("sendSmsCode posts phone+captchaId+code", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, null) as any);
    await apiUser.sendSmsCode("13800000000", "cid", "9a8b");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      phone: "13800000000", captchaId: "cid", code: "9a8b",
    });
  });
});
```

- [ ] **Step 4: 跑测试**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: PASS（token header 2 + methods 5，加 Task 2 的 3，共 10）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiUser.ts src/lib/__tests__/apiUser.test.ts
git commit -s -m "feat(auth): add apiUser auth header + business methods"
```

---

## Task 4: `apiUser` 401 自动刷新 + 重试 + 并发锁

**Files:**
- Modify: `src/lib/apiUser.ts`
- Test: `src/lib/__tests__/apiUser.test.ts`（追加）

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/lib/__tests__/apiUser.test.ts
import { apiUser, setUserSessionTokens, __getRefreshTokenForTest } from "../apiUser";

function unauthorized() {
  return {
    status: 401,
    ok: false,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify({ code: 401, message: "token expired" })),
  };
}

describe("apiUser — 401 refresh + retry", () => {
  beforeEach(() => setUserSessionTokens("old-tok", "old-rt"));

  it("refreshes token on 401 and retries the original request once", async () => {
    const fetchMock = vi.fn();
    // call 0: original 401 ; call 1: refreshToken 200 ; call 2: original retry 200
    fetchMock
      .mockResolvedValueOnce(unauthorized() as any)
      .mockResolvedValueOnce(json(1000, { token: "new-tok", refreshToken: "new-rt", expire: 1, refreshExpire: 2 }) as any)
      .mockResolvedValueOnce(json(1000, { ok: true }) as any);
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as any);

    const r = await (apiUser as any).request<{ ok: boolean }>("/secure");
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // retry used new token
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe("new-tok");
    // token + refreshToken updated for apiUser
    expect(__getRefreshTokenForTest()).toBe("new-rt");
  });

  it("coalesces concurrent 401s into a single refresh", async () => {
    const fetchMock = vi.fn();
    fetchMock
      // two originals 401
      .mockResolvedValueOnce(unauthorized() as any)
      .mockResolvedValueOnce(unauthorized() as any)
      // ONE refresh
      .mockResolvedValueOnce(json(1000, { token: "T2", refreshToken: "R2", expire: 1, refreshExpire: 1 }) as any)
      // two retries succeed
      .mockResolvedValueOnce(json(1000, { n: 1 }) as any)
      .mockResolvedValueOnce(json(1000, { n: 2 }) as any);
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as any);

    const [a, b] = await Promise.all([
      (apiUser as any).request<{ n: number }>("/a"),
      (apiUser as any).request<{ n: number }>("/b"),
    ]);
    expect(a.n).toBe(1);
    expect(b.n).toBe(2);
    // 2 originals + 1 refresh + 2 retries = 5
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("throws when refresh itself fails", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(unauthorized() as any)
      .mockResolvedValueOnce(json(1002, null, "refresh invalid") as any);
    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as any);

    await expect((apiUser as any).request("/secure")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: FAIL（refresh 未实现）。

- [ ] **Step 3: 实现刷新逻辑**

在 `src/lib/apiUser.ts` 的 `request` 函数**之前**加刷新器，并改造 `request`：

```ts
// src/lib/apiUser.ts —— 在 request 定义前插入：

let _refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const rt = _refreshToken;
  if (!rt) throw new UserApiError("未登录或登录已过期", { status: 401 });
  const result = await apiUser.refreshToken(rt); // skipAuthRefresh=true
  setUserSessionTokens(result.token, result.refreshToken);
}

/** 并发只刷新一次：所有 401 等同一个 promise。 */
function refreshOnce(): Promise<void> {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}
```

把 `request` 改造为：401 且未 `skipAuthRefresh` 时 → `refreshOnce()` 成功后用新 token 重试一次（递归调用但 `skipAuthRefresh=true` 防再循环），刷新失败则抛错。实现如下（替换原 `request` 主体末尾的返回段）：

```ts
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRefresh, headers, ...rest } = options;
  const buildHeaders = () => {
    const merged: Record<string, string> = { "Content-Type": "application/json" };
    if (_token) merged["Authorization"] = _token;
    if (headers) new Headers(headers).forEach((v, k) => (merged[k] = v));
    return merged;
  };

  const res = await fetch(`${BASE}${path}`, { ...rest, headers: buildHeaders() });

  if (res.status === 401 && !skipAuthRefresh) {
    await refreshOnce(); // 失败会抛，直接冒泡
    // 用新 token 重试一次，禁止再次刷新
    return request<T>(path, { ...options, skipAuthRefresh: true });
  }

  if (!res.ok) {
    throw new UserApiError(`HTTP ${res.status}`, { status: res.status });
  }
  const text = await res.text();
  const body: CoolResponse<T> = text ? JSON.parse(text) : ({ code: 1000, data: undefined as T });
  if (body.code !== 1000) {
    throw new UserApiError(body.message || `code=${body.code}`, { code: body.code });
  }
  return body.data;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: PASS（含新增 3 个 401 用例）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiUser.ts src/lib/__tests__/apiUser.test.ts
git commit -s -m "feat(auth): auto-refresh token on 401 with single-flight"
```

---

## Task 5: `apiUser` upload

**Files:**
- Modify: `src/lib/apiUser.ts`
- Test: `src/lib/__tests__/apiUser.test.ts`（追加）

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/lib/__tests__/apiUser.test.ts
describe("apiUser — upload", () => {
  it("posts multipart and returns {url}", async () => {
    setUserSessionTokens("tok", "rt");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(1000, { url: "https://cdn/x.png" }) as any);
    const file = new File(["data"], "a.png", { type: "image/png" });
    const r = await apiUser.upload(file);
    expect(r.url).toBe("https://cdn/x.png");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/app/base/comm/upload");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    // multipart 且未强制 JSON content-type
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe("tok");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: FAIL — upload 抛 "not implemented"。

- [ ] **Step 3: 实现 upload**

替换 apiUser 对象里的 `upload` 桩：

```ts
  upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (_token) headers["Authorization"] = _token; // 不设 Content-Type，让浏览器带 boundary
    return fetch(`${BASE}/app/base/comm/upload`, {
      method: "POST",
      headers,
      body: form,
    }).then(async (res) => {
      const text = await res.text();
      const body: CoolResponse<{ url: string; [k: string]: unknown }> = text
        ? JSON.parse(text)
        : { code: 1000, data: { url: "" } };
      if (body.code !== 1000) {
        throw new UserApiError(body.message || `code=${body.code}`, { code: body.code });
      }
      return body.data;
    });
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/__tests__/apiUser.test.ts`
Expected: PASS（upload 1 + 之前全部）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiUser.ts src/lib/__tests__/apiUser.test.ts
git commit -s -m "feat(auth): add avatar upload via /app/base/comm/upload"
```

---

## Task 6: auth store 基础（state + setSession + logout + persist）

**Files:**
- Create: `src/stores/auth.ts`
- Test: `src/stores/__tests__/auth.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/stores/__tests__/auth.test.ts
import { useAuthStore } from "../auth";

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().logout({ silent: true });
});

describe("auth store — initial state", () => {
  it("is guest with no tokens", () => {
    const s = useAuthStore.getState();
    expect(s.status).toBe("guest");
    expect(s.token).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.userInfo).toBeNull();
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
    useAuthStore.getState().updateUser({ nickName: "Neo" });
    // zustand persist 写 localStorage（key 见实现）
    const raw = localStorage.getItem("vibe_trading_auth");
    expect(raw).toBeTruthy();
    expect(raw!).toContain("t");
    expect(raw!).toContain("Neo");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/stores/__tests__/auth.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 store 基础**

```ts
// src/stores/auth.ts
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
  // Task 7 追加：bootstrap / fetchUserInfo
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "vibe_trading_auth",
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        expiresAt: s.expiresAt,
        userInfo: s.userInfo,
      }),
    }
  )
);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/stores/__tests__/auth.test.ts`
Expected: PASS（initial 1 + setSession 1 + logout 1 + persist 1）。

- [ ] **Step 5: Commit**

```bash
git add src/stores/auth.ts src/stores/__tests__/auth.test.ts
git commit -s -m "feat(auth): add auth store with persist + setSession/logout"
```

---

## Task 7: auth store `bootstrap` + `fetchUserInfo`

**Files:**
- Modify: `src/stores/auth.ts`
- Test: `src/stores/__tests__/auth.test.ts`（追加）

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/stores/__tests__/auth.test.ts
import { apiUser } from "@/lib/apiUser";
import type { UserInfo } from "@/types/user";

const userFixture = (): UserInfo => ({
  id: 7, gender: 1, status: 1, loginType: 2, nickName: "Neo", phone: "13800000000",
});

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/stores/__tests__/auth.test.ts`
Expected: FAIL — `bootstrap`/`fetchUserInfo` 未定义。

- [ ] **Step 3: 实现 bootstrap / fetchUserInfo**

在 `src/stores/auth.ts`：

1. `AuthState` 接口追加：
```ts
  bootstrap: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
```

2. store 工厂内追加（`setStatus` 之后）：
```ts
      fetchUserInfo: async () => {
        const u = await apiUser.getPerson();
        set({ userInfo: u });
      },

      bootstrap: async () => {
        const { token, expiresAt } = useAuthStore.getState();
        if (!token || (expiresAt && expiresAt < Date.now())) {
          // 无 token 或已过期（refresh 由 apiUser 401 兜底；这里先置 guest）
          if (!token) {
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
          useAuthStore.getState().logout({ silent: true });
        }
      },
```

> 说明：`setSession` 已在 Task 6 调用 `setUserSessionTokens` 把 token 同步给 apiUser；persist rehydrate 后 store 有 token 但 apiUser 的内存副本为空。需在 persist `onRehydrateStorage` 里补同步。加在 `persist` 配置中：

```ts
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setUserSessionTokens(state.token, state.refreshToken);
        } else {
          state?.setStatus("guest");
        }
      },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/stores/__tests__/auth.test.ts`
Expected: PASS（新增 4 个 + Task 6 的 4 个）。

- [ ] **Step 5: Commit**

```bash
git add src/stores/auth.ts src/stores/__tests__/auth.test.ts
git commit -s -m "feat(auth): add bootstrap + fetchUserInfo with persist rehydrate"
```

---

## Task 8: `RequireAuth` 路由守卫

**Files:**
- Create: `src/components/auth/RequireAuth.tsx`
- Test: `src/components/auth/__tests__/RequireAuth.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/components/auth/__tests__/RequireAuth.test.tsx
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { RequireAuth } from "../RequireAuth";
import { useAuthStore } from "@/stores/auth";

function setup(status: "loading" | "guest" | "authenticated") {
  useAuthStore.setState({ status });
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<div>profile page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, refreshToken: null, userInfo: null, expiresAt: null, status: "guest" });
});

describe("RequireAuth", () => {
  it("shows loading when status=loading", () => {
    setup("loading");
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("redirects to /login when guest", () => {
    setup("guest");
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("profile page")).toBeNull();
  });

  it("renders outlet when authenticated", () => {
    useAuthStore.setState({ status: "authenticated", token: "t", userInfo: { id: 1, gender: 0, status: 1, loginType: 2 } as any });
    setup("authenticated");
    expect(screen.getByText("profile page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/auth/__tests__/RequireAuth.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现守卫**

```tsx
// src/components/auth/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/auth/__tests__/RequireAuth.test.tsx`
Expected: PASS（3 用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/RequireAuth.tsx src/components/auth/__tests__/RequireAuth.test.tsx
git commit -s -m "feat(auth): add RequireAuth route guard"
```

---

## Task 9: vite proxy `/user-api` + env

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: 改 vite.config.ts**

在 `PROXY_PATHS` 数组之后、`export default` 之内，把 proxy 表扩展。定位到现有 `proxy: { ... }`（约 39-49 行），在 `"/correlation": apiProxyWithHtmlFallback,` 之后追加：

```ts
        "/user-api": {
          target: env.VITE_USER_API_URL || "http://127.0.0.1:8001",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/user-api/, ""),
        },
```

并在文件顶部 `const apiTarget = env.VITE_API_URL || "http://127.0.0.1:8899";` 之后无需改动（user-api 的 target 直接内联读取 env，保持局部）。

- [ ] **Step 2: 类型检查**

Run: `npx tsc -b --noEmit`
Expected: 无新增错误。

- [ ] **Step 3: 手动验证（需后端 `:8001` 在跑）**

Run: `npx vite dev &`，然后 `curl -s "http://127.0.0.1:5899/user-api/app/user/login/captcha" | head -c 200`
Expected: 返回 cool-admin 的 `{code:1000,data:{captchaId,...}}`（或后端未起则连接拒绝——属预期，proxy 规则正确即可）。

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -s -m "feat(auth): proxy /user-api to cool-admin backend"
```

---

## Task 10: `UserMenu`（Header 用户入口）

**Files:**
- Create: `src/components/layout/UserMenu.tsx`
- Test: `src/components/layout/__tests__/UserMenu.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/components/layout/__tests__/UserMenu.test.tsx
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "../UserMenu";
import { useAuthStore } from "@/stores/auth";

function renderMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, refreshToken: null, userInfo: null, expiresAt: null, status: "guest" });
});

describe("UserMenu", () => {
  it("shows login link when guest", () => {
    renderMenu();
    expect(screen.getByRole("link", { name: /登录|login/i })).toHaveAttribute("href", "/login");
  });

  it("shows nickname + logout when authenticated", async () => {
    useAuthStore.setState({
      status: "authenticated",
      token: "t",
      userInfo: { id: 1, nickName: "Neo", gender: 0, status: 1, loginType: 2 } as any,
    });
    renderMenu();
    expect(screen.getByText("Neo")).toBeInTheDocument();
    // 退出按钮存在
    expect(screen.getByRole("button", { name: /退出|logout/i })).toBeInTheDocument();
  });

  it("logout button clears session", async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), "logout");
    useAuthStore.setState({
      status: "authenticated",
      token: "t",
      userInfo: { id: 1, nickName: "Neo", gender: 0, status: 1, loginType: 2 } as any,
    });
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /退出|logout/i }));
    expect(logoutSpy).toHaveBeenCalled();
    logoutSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/layout/__tests__/UserMenu.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现 UserMenu**

```tsx
// src/components/layout/UserMenu.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "react-i18next";

export function UserMenu() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const userInfo = useAuthStore((s) => s.userInfo);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />;
  }
  if (status !== "authenticated") {
    return (
      <Link
        to="/login"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted"
      >
        <User className="h-3.5 w-3.5" />
        {t("userMenu.login")}
      </Link>
    );
  }

  const name = userInfo?.nickName || t("userMenu.guest");
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="relative" data-testid="user-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-muted"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate">{name}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border bg-popover p-1 text-xs shadow-md">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-foreground hover:bg-muted"
            >
              <User className="h-3.5 w-3.5" />
              {t("userMenu.profile")}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-danger hover:bg-danger/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("userMenu.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

> 样式 token `bg-popover`/`text-danger`：项目 Tailwind 配置含 `muted`/`primary`/`destructive` 等（见 `tailwind.config.ts`）。若 `popover`/`danger` 未定义，改用 `bg-card`/`text-destructive`（实现时以 `tailwind.config.ts` 实际 key 为准）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/layout/__tests__/UserMenu.test.tsx`
Expected: PASS（3 用例）。注意：测试在 Task 14 加 i18n key 前会因 `userMenu.login` 缺失而显示 key 字面量——`getByRole("link", {name: /登录|login/i})` 正则需匹配渲染结果。**若 i18n key 尚未加，先在 zh-CN.json/en.json 临时加 `userMenu.login`/`profile`/`logout`/`guest` 最小集合**（见 Task 14 完整文案），再跑测试。

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/UserMenu.tsx src/components/layout/__tests__/UserMenu.test.tsx src/i18n/locales/zh-CN.json src/i18n/locales/en.json
git commit -s -m "feat(auth): add UserMenu header entry with i18n keys"
```

---

## Task 11: 登录页 `src/pages/auth/Login.tsx`

**Files:**
- Create: `src/pages/auth/Login.tsx`
- Test: `src/pages/auth/__tests__/Login.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/pages/auth/__tests__/Login.test.tsx
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../Login";
import { useAuthStore } from "@/stores/auth";
import { apiUser } from "@/lib/apiUser";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<div>profile page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, refreshToken: null, userInfo: null, expiresAt: null, status: "guest" });
  vi.restoreAllMocks();
});

describe("Login page", () => {
  it("disables submit until phone+smsCode valid", async () => {
    vi.spyOn(apiUser, "getCaptcha").mockResolvedValue({ captchaId: "c1", data: "<svg/>" });
    renderLogin();
    await waitFor(() => expect(apiUser.getCaptcha).toHaveBeenCalled());
    const submit = screen.getByRole("button", { name: /登录|register|登/i });
    expect(submit).toBeDisabled();
  });

  it("sends sms code with phone + captchaId + captcha input", async () => {
    const cap = vi.spyOn(apiUser, "getCaptcha").mockResolvedValue({ captchaId: "c1", data: "<svg/>" });
    const sms = vi.spyOn(apiUser, "sendSmsCode").mockResolvedValue(undefined);
    renderLogin();
    await waitFor(() => expect(cap).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText(/13800000000|手机/), "13800000000");
    await userEvent.type(screen.getByPlaceholderText(/图形|captcha/i), "9a8b");
    await userEvent.click(screen.getByRole("button", { name: /获取|send|get.*code/i }));

    await waitFor(() => expect(sms).toHaveBeenCalledWith("13800000000", "c1", "9a8b"));
  });

  it("logs in and navigates to /profile", async () => {
    vi.spyOn(apiUser, "getCaptcha").mockResolvedValue({ captchaId: "c1", data: "<svg/>" });
    vi.spyOn(apiUser, "sendSmsCode").mockResolvedValue(undefined);
    const login = vi.spyOn(apiUser, "loginByPhone").mockResolvedValue({
      token: "T", refreshToken: "R", expire: 3600, refreshExpire: 7200,
    });
    const person = vi.spyOn(apiUser, "getPerson").mockResolvedValue({
      id: 1, nickName: "Neo", gender: 0, status: 1, loginType: 2,
    });
    renderLogin();
    await waitFor(() => expect(screen.getByPlaceholderText(/13800000000|手机/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/13800000000|手机/), "13800000000");
    await userEvent.type(screen.getByPlaceholderText(/图形|captcha/i), "9a8b");
    await userEvent.click(screen.getByRole("button", { name: /获取|send|get.*code/i }));
    await waitFor(() => expect(login).not.toHaveBeenCalled()); // still need sms code

    await userEvent.type(screen.getByPlaceholderText(/短信|sms.*code/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /登录|register|登/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("13800000000", "1234"));
    await waitFor(() => expect(person).toHaveBeenCalled());
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(screen.getByText("profile page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/pages/auth/__tests__/Login.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现 Login**

```tsx
// src/pages/auth/Login.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiUser } from "@/lib/apiUser";
import { useAuthStore } from "@/stores/auth";

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const hintClass = "text-xs text-muted-foreground";

const PHONE_RE = /^1\d{10}$/;
const isCode4 = (s: string) => /^\d{4}$/.test(s) || /^[0-9a-zA-Z]{4}$/.test(s);

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchUserInfo = useAuthStore((s) => s.fetchUserInfo);
  const status = useAuthStore((s) => s.status);

  const [captcha, setCaptcha] = useState<{ captchaId: string; data: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCaptcha = async () => {
    try {
      const c = await apiUser.getCaptcha({ width: 120, height: 40 });
      setCaptcha(c);
    } catch (e) {
      toast.error((e as Error).message || t("auth.errors.captchaLoad"));
    }
  };

  useEffect(() => {
    void loadCaptcha();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 已登录则跳走
  useEffect(() => {
    if (status === "authenticated") navigate("/profile", { replace: true });
  }, [status, navigate]);

  const phoneValid = PHONE_RE.test(phone);
  const captchaValid = isCode4(captchaCode);
  const smsValid = isCode4(smsCode);

  const sendCode = async () => {
    if (!phoneValid || !captchaValid || sending || countdown > 0) return;
    if (!captcha) return;
    setSending(true);
    try {
      await apiUser.sendSmsCode(phone, captcha.captchaId, captchaCode);
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((n) => {
          if (n <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return n - 1;
        });
      }, 1000);
      toast.success(t("auth.smsSent"));
    } catch (e) {
      toast.error((e as Error).message || t("auth.errors.smsFailed"));
      void loadCaptcha(); // 图形码可能失效，刷新
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    if (!phoneValid || !smsValid || submitting) return;
    setSubmitting(true);
    try {
      const r = await apiUser.loginByPhone(phone, smsCode);
      setSession(r);
      await fetchUserInfo();
      toast.success(t("auth.loginSuccess"));
      navigate("/profile", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || t("auth.errors.loginFailed"));
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">{t("auth.title")}</h1>
        <p className="mb-5 text-xs text-muted-foreground">{t("auth.subtitle")}</p>

        <div className="space-y-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("auth.phone")}</span>
            <input
              className={fieldClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="13800000000"
              inputMode="numeric"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("auth.captcha")}</span>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value.trim().slice(0, 4))}
                placeholder="abcd"
              />
              <button
                type="button"
                onClick={loadCaptcha}
                title={t("auth.refreshCaptcha")}
                className="flex h-[38px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30"
              >
                {captcha ? (
                  <img src={`data:image/svg+xml;base64,${captcha.data}`} alt="captcha" className="h-full w-full object-cover" />
                ) : (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </button>
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("auth.smsCode")}</span>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.trim().slice(0, 4))}
                placeholder="1234"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={!phoneValid || !captchaValid || sending || countdown > 0}
                className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1 rounded-md border px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {countdown > 0
                  ? t("auth.countdown", { n: countdown })
                  : sending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : t("auth.getCode")}
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!phoneValid || !smsValid || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("auth.submit")}
          </button>
          <p className={hintClass}>{t("auth.firstLoginHint")}</p>
        </div>
      </div>
    </div>
  );
}
```

> `captcha.data` 若 cool-admin 返回的已经是完整 data URI（含 `data:image/svg+xml;base64,` 前缀），则 `src` 直接用 `captcha.data`；若是裸 base64，用上面 `data:image/svg+xml;base64,${captcha.data}`。实现时打开浏览器 DevTools 确认一次（属第 15 task 联调）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/pages/auth/__tests__/Login.test.tsx`
Expected: PASS（3 用例）。需 Task 14 的 `auth.*` i18n key（先临时补最小集合）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/Login.tsx src/pages/auth/__tests__/Login.test.tsx src/i18n/locales/zh-CN.json src/i18n/locales/en.json
git commit -s -m "feat(auth): add Login page with double-captcha flow"
```

---

## Task 12: 个人信息页 `src/pages/profile/Profile.tsx`

**Files:**
- Create: `src/pages/profile/Profile.tsx`
- Test: `src/pages/profile/__tests__/Profile.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/pages/profile/__tests__/Profile.test.tsx
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profile } from "../Profile";
import { useAuthStore } from "@/stores/auth";
import { apiUser } from "@/lib/apiUser";

function renderProfile() {
  return render(<MemoryRouter><Profile /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    status: "authenticated",
    token: "t",
    userInfo: { id: 1, nickName: "Neo", phone: "13800001234", gender: 1, status: 1, loginType: 2, avatarUrl: null, description: "" } as any,
    expiresAt: Date.now() + 1e6,
  });
  vi.restoreAllMocks();
});

describe("Profile page", () => {
  it("masks phone number (138****1234)", async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText(/138\*+1234/)).toBeInTheDocument());
  });

  it("saves nickname via updatePerson", async () => {
    const upd = vi.spyOn(apiUser, "updatePerson").mockResolvedValue({
      id: 1, nickName: "Neo2", phone: "13800001234", gender: 1, status: 1, loginType: 2,
    } as any);
    renderProfile();
    const input = screen.getByDisplayValue("Neo");
    await userEvent.clear(input);
    await userEvent.type(input, "Neo2");
    await userEvent.click(screen.getByRole("button", { name: /^保存|save$/i }));
    await waitFor(() => expect(upd).toHaveBeenCalledWith(expect.objectContaining({ nickName: "Neo2" })));
  });

  it("logout button clears session", async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), "logout");
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: /退出|logout/i }));
    expect(logoutSpy).toHaveBeenCalled();
    logoutSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/pages/profile/__tests__/Profile.test.tsx`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 实现 Profile**

```tsx
// src/pages/profile/Profile.tsx
import { useState } from "react";
import { Loader2, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiUser } from "@/lib/apiUser";
import { useAuthStore } from "@/stores/auth";

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelClass = "text-sm font-medium";

function maskPhone(p?: string | null) {
  if (!p || p.length < 7) return p || "";
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

export function Profile() {
  const { t } = useTranslation();
  const userInfo = useAuthStore((s) => s.userInfo);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  const [nickName, setNickName] = useState(userInfo?.nickName || "");
  const [gender, setGender] = useState<number>(userInfo?.gender ?? 0);
  const [description, setDescription] = useState(userInfo?.description || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiUser.updatePerson({ nickName, gender, description });
      updateUser(updated);
      toast.success(t("profile.saved"));
    } catch (e) {
      toast.error((e as Error).message || t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await apiUser.upload(file);
      const updated = await apiUser.updatePerson({ avatarUrl: url });
      updateUser(updated);
      toast.success(t("profile.avatarUpdated"));
    } catch (e) {
      toast.error((e as Error).message || t("profile.avatarFailed"));
    } finally {
      setUploading(false);
    }
  };

  const onLogout = () => {
    logout();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.6fr)_minmax(0,1.4fr)]">
        {/* Left: avatar + phone + logout */}
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <label className="block cursor-pointer">
            <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted">
              {userInfo?.avatarUrl ? (
                <img src={userInfo.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-3xl text-muted-foreground">
                  {(nickName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
          </label>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t("profile.phone")}</div>
              <div className="font-medium">{maskPhone(userInfo?.phone)}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              {t("profile.logout")}
            </button>
          </div>
        </section>

        {/* Right: editable fields */}
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className={labelClass}>{t("profile.nickName")}</span>
              <input className={fieldClass} value={nickName} onChange={(e) => setNickName(e.target.value)} />
            </label>

            <div className="grid gap-2">
              <span className={labelClass}>{t("profile.gender")}</span>
              <div className="flex gap-4 text-sm">
                {[0, 1, 2].map((g) => (
                  <label key={g} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="gender"
                      checked={gender === g}
                      onChange={() => setGender(g)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {t(`profile.genderOptions.${g}`)}
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className={labelClass}>{t("profile.description")}</span>
              <textarea
                className={fieldClass}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("profile.save")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/pages/profile/__tests__/Profile.test.tsx`
Expected: PASS（3 用例）。需 `profile.*` i18n key。

- [ ] **Step 5: Commit**

```bash
git add src/pages/profile/Profile.tsx src/pages/profile/__tests__/Profile.test.tsx src/i18n/locales/zh-CN.json src/i18n/locales/en.json
git commit -s -m "feat(auth): add Profile page (view/edit/logout)"
```

---

## Task 13: 路由接线 + main.tsx bootstrap + Layout 接入 UserMenu

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/main.tsx`
- Modify: `src/components/layout/Layout.tsx`

- [ ] **Step 1: router.tsx — 加 lazy import 与路由**

在 router.tsx 顶部 import 区追加（`AlphaZoo` lazy 之后）：

```tsx
const Login = lazy(() => import("@/pages/auth/Login").then((m) => ({ default: m.Login })));
const Profile = lazy(() => import("@/pages/profile/Profile").then((m) => ({ default: m.Profile })));
const RequireAuth = (
  await import("@/components/auth/RequireAuth")
).RequireAuth;
```

> 注意：`RequireAuth` 不必 lazy（很小）。用普通 import 更简单。把上面 `RequireAuth` 改为顶部 `import { RequireAuth } from "@/components/auth/RequireAuth";`。

把 `createBrowserRouter([...])` 改为：在现有数组里**新增一个顶层 `/login` 路由（不进 Layout）**，并在 Layout children 里加 `/profile`：

```tsx
export const router = createBrowserRouter([
  { path: "/login", element: wrap(Login) },
  {
    element: <Layout />,
    children: [
      { path: "/", element: wrap(Home) },
      { path: "/agent", element: wrap(Agent) },
      { path: "/runtime", element: wrap(Runtime) },
      { path: "/settings", element: wrap(Settings) },
      { path: "/runs/:runId", element: wrap(RunDetail) },
      { path: "/compare", element: wrap(Compare) },
      { path: "/correlation", element: wrap(Correlation) },
      { path: "/alpha-zoo", element: wrap(AlphaZoo) },
      { path: "/alpha-zoo/bench", element: wrap(AlphaZoo) },
      { path: "/alpha-zoo/compare", element: wrap(AlphaZoo) },
      { path: "/alpha-zoo/:alphaId", element: wrap(AlphaZoo) },
      {
        path: "/profile",
        element: (
          <RequireAuth>
            {wrap(Profile)}
          </RequireAuth>
        ),
      },
    ],
  },
]);
```

> `RequireAuth` 当前实现用 `<Outlet/>`，不接 children。改用嵌套路由更干净：把 `/profile` 包成 `RequireAuth` 的子路由。最简写法（推荐）：

```tsx
      {
        element: <RequireAuth />,
        children: [{ path: "/profile", element: wrap(Profile) }],
      },
```

把上面 `/profile` 项替换为此嵌套形式，置于 children 末尾。

- [ ] **Step 2: main.tsx — 启动 bootstrap**

在 `import './i18n';` 之后、`createRoot` 之前追加：

```tsx
import { useAuthStore } from "@/stores/auth";
// App 启动时初始化 auth 状态（有 token 则拉取 person，否则 guest）
void useAuthStore.getState().bootstrap();
```

- [ ] **Step 3: Layout.tsx — header 接入 UserMenu**

在 Layout.tsx 顶部 import 区追加：

```tsx
import { UserMenu } from "@/components/layout/UserMenu";
```

定位到 `<header ...>` 内的 tablist `<div ... className="flex min-w-0 flex-1 ...">`（约 474-534 行）**之后**、`</header>` 之前，追加：

```tsx
        <div className="flex shrink-0 items-center pl-2">
          <UserMenu />
        </div>
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 5: 全量测试**

Run: `npx vitest run`
Expected: 全部 PASS（含原有测试）。

- [ ] **Step 6: Commit**

```bash
git add src/router.tsx src/main.tsx src/components/layout/Layout.tsx
git commit -s -m "feat(auth): wire /login & /profile routes, bootstrap, header UserMenu"
```

---

## Task 14: i18n 文案（zh-CN + en）

**Files:**
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: zh-CN.json 追加命名空间**

在 JSON 顶层对象内追加（与 `app`/`layout`/`settings` 平级）：

```json
  "auth": {
    "title": "登录 / 注册",
    "subtitle": "首次验证码登录将自动注册账号",
    "phone": "手机号",
    "captcha": "图形验证码",
    "refreshCaptcha": "刷新图形码",
    "smsCode": "短信验证码",
    "getCode": "获取验证码",
    "countdown": "{{n}}s 后重发",
    "smsSent": "验证码已发送",
    "submit": "登录 / 注册",
    "firstLoginHint": "首次验证码登录将自动注册",
    "loginSuccess": "登录成功",
    "errors": {
      "captchaLoad": "图形验证码加载失败",
      "smsFailed": "验证码发送失败",
      "loginFailed": "登录失败"
    }
  },
  "profile": {
    "title": "个人信息",
    "phone": "手机号",
    "nickName": "昵称",
    "gender": "性别",
    "genderOptions": { "0": "未知", "1": "男", "2": "女" },
    "description": "介绍",
    "save": "保存",
    "saved": "已保存",
    "saveFailed": "保存失败",
    "avatarUpdated": "头像已更新",
    "avatarFailed": "头像上传失败",
    "logout": "退出登录"
  },
  "userMenu": {
    "login": "登录",
    "profile": "个人信息",
    "logout": "退出登录",
    "guest": "未命名"
  },
```

- [ ] **Step 2: en.json 追加对应英文**

```json
  "auth": {
    "title": "Login / Register",
    "subtitle": "First verification-code login creates your account automatically",
    "phone": "Phone",
    "captcha": "Captcha",
    "refreshCaptcha": "Refresh captcha",
    "smsCode": "SMS code",
    "getCode": "Send code",
    "countdown": "Resend in {{n}}s",
    "smsSent": "Code sent",
    "submit": "Login / Register",
    "firstLoginHint": "First login registers your account",
    "loginSuccess": "Logged in",
    "errors": {
      "captchaLoad": "Failed to load captcha",
      "smsFailed": "Failed to send code",
      "loginFailed": "Login failed"
    }
  },
  "profile": {
    "title": "Profile",
    "phone": "Phone",
    "nickName": "Nickname",
    "gender": "Gender",
    "genderOptions": { "0": "Unknown", "1": "Male", "2": "Female" },
    "description": "Bio",
    "save": "Save",
    "saved": "Saved",
    "saveFailed": "Save failed",
    "avatarUpdated": "Avatar updated",
    "avatarFailed": "Avatar upload failed",
    "logout": "Log out"
  },
  "userMenu": {
    "login": "Login",
    "profile": "Profile",
    "logout": "Log out",
    "guest": "Unnamed"
  },
```

> 注意 JSON 合法性：追加时确保与上一个同级 key 之间有逗号；两份文件 key 结构必须完全一致。

- [ ] **Step 3: 校验 JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh-CN.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`。

- [ ] **Step 4: 全量测试 + 类型**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: 全 PASS，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/zh-CN.json src/i18n/locales/en.json
git commit -s -m "feat(auth): add i18n strings for auth/profile/userMenu"
```

---

## Task 15: 构建 + 联调验证

- [ ] **Step 1: 生产构建**

Run: `npm run build`
Expected: `tsc -b` 与 `vite build` 均成功，无错误。

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: 全部 PASS（新增 ~25 用例 + 原有全部）。

- [ ] **Step 3: 端到端手动验证（需后端 DYPNS 已打通，见后端计划）**

Run: `npm run dev`，浏览器开 `http://127.0.0.1:5899`：
1. 未登录态：Header 右侧显"登录"。
2. 点登录 → `/login`：图形码加载（看 Network `/user-api/app/user/login/captcha` 200，确认 `captcha.data` 是裸 base64 还是 data URI，据此校正 `src`）。
3. 输手机号+图形码 → 获取短信码（看 `/user-api/app/user/login/smsCode` 200；若后端 DYPNS 未通会返回"未配置短信插件"或阿里云错误，属后端计划范畴）。
4. 输短信码 → 登录 → 跳 `/profile`，Header 显昵称。
5. `/profile` 改昵称保存、换头像、退出登录 → 回 `/login`。
6. 直接访问 `/profile`（未登录）→ 跳 `/login`。

- [ ] **Step 4: Commit（若有联调微调）**

```bash
git add -A
git commit -s -m "fix(auth): e2e polish after manual verification"
```

> 若无需微调，此步可跳过。

---

## Self-Review（写计划后自查结果）

- **Spec 覆盖**：设计文档 §3.1 全部交付项 → Task 1-15 覆盖（types/apiUser/store/RequireAuth/vite/Login/Profile/UserMenu/router/main/Layout/i18n/build）。§3.2 非目标（密码登录/改密/注销/绑机/桌面打包）均未在本计划实现，符合范围。
- **占位符**：无 TBD/TODO。Task 5 upload、Task 13 RequireAuth 嵌套写法均给出最终代码。
- **类型一致**：`LoginResult{token,refreshToken,expire,refreshExpire}`、`UserInfo`、`Captcha`、`AuthStatus`、`setUserSessionTokens(token,refreshToken)`、`__getRefreshTokenForTest` 跨 task 名称一致；store action `setSession/updateUser/setUserInfo/logout/setStatus/bootstrap/fetchUserInfo` 全链路一致。
- **已知需联调确认**（非占位，已在 Task 11/15 标注）：cool-admin `captcha.data` 是否含 data URI 前缀；`upload` 返回 `data.url` 字段名；Tailwind `popover`/`danger` token 是否存在（否则用 `card`/`destructive`）。
