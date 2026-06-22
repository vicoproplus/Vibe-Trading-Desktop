# 后端 DYPNS 短信配套实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `cool-admin-midway` 后端**新增**基于阿里云 DYPNS（`@alicloud/dypnsapi20170525`）的短信发送 + 校验 service，并接入 `/app/user/login/smsCode` 与 `/app/user/login/phone`，使前端登录端到端可跑通。**不修改** `src/modules/user/service/sms.ts`。

**Architecture:** 新增 `UserDypnsSmsService`（`send` 调 `SendSmsVerifyCode`、`check` 调 `CheckSmsVerifyCode`，验证码由阿里云生成与维护、后端不存）。改造 `UserLoginService.smsCode/phoneVerifyCode` 两个方法，把对 `userSmsService` 的调用换成 `dypnsSmsService`。`sms.ts` 原样保留。

**Tech Stack:** Midway.js 3 + cool-admin 8、TypeScript、阿里云 DYPNS SDK、jest + ts-jest + @midwayjs/mock。

**设计依据:** `docs/superpowers/specs/2026-06-22-user-auth-design.md` §11。

**仓库:** 本计划所有路径相对 `cool-admin-midway/`（`/Users/niean/Documents/project/cool-admin-midway`）。前端见 `2026-06-22-user-auth-frontend.md`。

**当前分支:** 后端仓库请先确认/创建分支（如 `feat/dypns-sms`），`git commit -s` 提交。

---

## 现有代码（已核对）

`src/modules/user/service/login.ts`：
- `smsCode(phone, captchaId, code)`（47-54）：`baseSysLoginService.captchaCheck(captchaId, code)` → `this.userSmsService.sendSms(phone)`
- `phoneVerifyCode(phone, smsCode)`（61-69）：`this.userSmsService.checkCode(phone, smsCode)` → 通过则 `this.phone(phone)`（首次建号 + 签 token）
- 注入：`@Inject() userSmsService: UserSmsService`（38-39）

`src/modules/user/service/sms.ts`：`UserSmsService`，`sendSms` 本地生成验证码 + midwayCache 存；`checkCode` 从 midwayCache 比对。**本计划不改此文件。**

`src/modules/user/config.ts`：返回 `{ name, sms:{timeout}, jwt:{...} }`。`@Config('module.user.sms')` / `@Config('module.user.jwt')` 读。新增配置走 `module.user.dypns`。

cool-admin 模块扫描：`src/modules/*/service/` 下 `@Provide()` 的 class 自动注册到 DI 容器，无需改 module 声明。

测试：`npm test` = `cross-env NODE_ENV=unittest jest`，jest 配置见仓库根（ts-jest）。`test/` 目录已有用例。

## 阿里云 DYPNS 接口（设计文档 §11.1）

| 接口 | 入参 | 返回 |
|---|---|---|
| `SendSmsVerifyCode` | `PhoneNumber`、`SignName`、`TemplateCode`、`TemplateParam?`、`DuplicatePolicy?`、`SchemeName?` | `body`（`code`/`message`/`model`），**不返回验证码明文** |
| `CheckSmsVerifyCode` | `PhoneNumber`、`VerifyCode`、`SchemeName?` | `body.model.verifyResult`（`PASS`/`NOT_PASS`） |

> 字段名以 SDK `@alicloud/dypnsapi20170525` 的 d.ts 为准（实现时核对一次）。阿里云侧验证码有效期约 5 分钟，后端**不存验证码**。

## File Structure

**Create:**
- `src/modules/user/service/dypnsSms.ts` — DYPNS 发送+校验 service
- `test/user-dypnsSms.test.ts` — jest 单测

**Modify:**
- `src/modules/user/config.ts` — 加 `dypns` 配置块（读 env）
- `src/modules/user/service/login.ts` — `smsCode`/`phoneVerifyCode` 改调 `dypnsSmsService`（仅 2 处调用 + 1 处注入）
- `package.json` — 新增阿里云 SDK 依赖（由 `npm i` 落盘）
- `.env`（本地，**不进仓库**）— DYPNS 凭据与模板

**NOT modify:** `src/modules/user/service/sms.ts`（保持原样）

---

## Task 1: 安装阿里云 SDK 依赖

**Files:**
- Modify: `package.json`（由 npm 自动写）

- [ ] **Step 1: 安装依赖**

```bash
cd /Users/niean/Documents/project/cool-admin-midway
npm i @alicloud/dypnsapi20170525 @alicloud/openapi-client @alicloud/tea-util @alicloud/credentials
```

- [ ] **Step 2: 确认安装**

Run: `node -e "require('@alicloud/dypnsapi20170525'); require('@alicloud/openapi-client'); require('@alicloud/tea-util'); require('@alicloud/credentials'); console.log('ok')"`
Expected: 输出 `ok`。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -s -m "chore(sms): add aliyun DYPNS SDK dependencies"
```

---

## Task 2: 新增 `UserDypnsSmsService` + 单测

**Files:**
- Create: `src/modules/user/service/dypnsSms.ts`
- Test: `test/user-dypnsSms.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// test/user-dypnsSms.test.ts
import { UserDypnsSmsService } from '../src/modules/user/service/dypnsSms';

describe('UserDypnsSmsService', () => {
  let svc: UserDypnsSmsService;
  let sendSpy: jest.Mock;
  let checkSpy: jest.Mock;

  beforeEach(() => {
    svc = new UserDypnsSmsService();
    (svc as any).config = {
      signName: '速通互联验证码',
      templateCode: '100001',
      templateParam: '{"min":"5"}',
      endpoint: 'dypnsapi.aliyuncs.com',
    };
    sendSpy = jest.fn();
    checkSpy = jest.fn();
    // mock 阿里云 client（init 后注入实例，绕过真实网络）
    (svc as any).client = {
      sendSmsVerifyCodeWithOptions: sendSpy,
      checkSmsVerifyCodeWithOptions: checkSpy,
    };
  });

  it('send resolves when SDK returns code=OK', async () => {
    sendSpy.mockResolvedValue({ body: { code: 'OK', message: 'OK' } });
    await expect(svc.send('13800000000')).resolves.toBeUndefined();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const req = sendSpy.mock.calls[0][0];
    expect(req.phoneNumber).toBe('13800000000');
    expect(req.signName).toBe('速通互联验证码');
    expect(req.templateCode).toBe('100001');
  });

  it('send throws CoolCommException when SDK returns non-OK', async () => {
    sendSpy.mockResolvedValue({ body: { code: 'isv.BUSINESS_LIMIT_CONTROL', message: '限流' } });
    await expect(svc.send('13800000000')).rejects.toThrow(/限流|短信发送失败/);
  });

  it('send wraps network/SDK errors', async () => {
    sendSpy.mockRejectedValue(new Error('timeout'));
    await expect(svc.send('13800000000')).rejects.toThrow(/短信发送失败/);
  });

  it('check returns true when verifyResult=PASS', async () => {
    checkSpy.mockResolvedValue({ body: { model: { verifyResult: 'PASS' } } });
    await expect(svc.check('13800000000', '1234')).resolves.toBe(true);
    expect(checkSpy.mock.calls[0][0].phoneNumber).toBe('13800000000');
    expect(checkSpy.mock.calls[0][0].verifyCode).toBe('1234');
  });

  it('check returns false when verifyResult=NOT_PASS', async () => {
    checkSpy.mockResolvedValue({ body: { model: { verifyResult: 'NOT_PASS' } } });
    await expect(svc.check('13800000000', '0000')).resolves.toBe(false);
  });

  it('check returns false when verifyResult missing', async () => {
    checkSpy.mockResolvedValue({ body: { model: {} } });
    await expect(svc.check('13800000000', '1234')).resolves.toBe(false);
  });
});
```

> 说明：测试直接 `new` 出 service 实例并替换 `client` 字段，绕过 midway DI 与真实阿里云网络。`@Init`/`@Config` 在测试里不触发（不走 DI），手动赋值 `config` 与 `client`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx jest test/user-dypnsSms.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 service**

```ts
// src/modules/user/service/dypnsSms.ts
import { Provide, Config, Init } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import Dypnsapi20170525, {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from '@alicloud/dypnsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';
import * as Credential from '@alicloud/credentials';

/**
 * 阿里云 DYPNS 号码认证服务 —— 发送短信验证码 + 校验。
 * 验证码由阿里云生成并维护（手机号 ↔ 验证码映射），后端不存储。
 * 不依赖、不修改原有 UserSmsService（sms.ts）。
 */
@Provide()
export class UserDypnsSmsService extends BaseService {
  @Config('module.user.dypns')
  config: {
    accessKeyId?: string;
    accessKeySecret?: string;
    signName: string;
    templateCode: string;
    templateParam?: string;
    endpoint?: string;
  };

  private client: InstanceType<typeof Dypnsapi20170525>;

  @Init()
  async init() {
    const c = this.config || ({} as any);
    // 凭据：显式 AK 优先；否则走 @alicloud/credentials 默认链（env ALIBABA_CLOUD_*）
    const credential =
      c.accessKeyId && c.accessKeySecret
        ? new Credential.default({
            type: 'access_key',
            accessKeyId: c.accessKeyId,
            accessKeySecret: c.accessKeySecret,
          })
        : new Credential.default();
    const conf = new OpenApi.Config({ credential });
    conf.endpoint = c.endpoint || 'dypnsapi.aliyuncs.com';
    this.client = new Dypnsapi20170525(conf);
  }

  /** 发送短信验证码（阿里云生成验证码，通过短信下发）。 */
  async send(phone: string): Promise<void> {
    const c = this.config || ({} as any);
    const req = new SendSmsVerifyCodeRequest({
      phoneNumber: phone,
      signName: c.signName,
      templateCode: c.templateCode,
      templateParam: c.templateParam || '{}',
    });
    try {
      const resp: any = await this.client.sendSmsVerifyCodeWithOptions(
        req,
        new Util.RuntimeOptions({})
      );
      const code = resp?.body?.code;
      if (code && code !== 'OK') {
        throw new CoolCommException(resp?.body?.message || '短信发送失败');
      }
    } catch (e) {
      if (e instanceof CoolCommException) throw e;
      throw new CoolCommException('短信发送失败：' + (e as any)?.message);
    }
  }

  /** 校验用户输入的验证码；阿里云返回 PASS 才为 true。 */
  async check(phone: string, code: string): Promise<boolean> {
    const req = new CheckSmsVerifyCodeRequest({
      phoneNumber: phone,
      verifyCode: code,
    });
    try {
      const resp: any = await this.client.checkSmsVerifyCodeWithOptions(
        req,
        new Util.RuntimeOptions({})
      );
      const result = resp?.body?.model?.verifyResult;
      return result === 'PASS' || result === true;
    } catch (e) {
      throw new CoolCommException('验证码校验失败：' + (e as any)?.message);
    }
  }
}
```

> **default import 兼容**：若 TS 报 `Dypnsapi20170525` 不可 new（d.ts 无 default export 形态），改顶部为：
> ```ts
> import * as Dypnsapi20170525ns from '@alicloud/dypnsapi20170525';
> const Dypnsapi20170525 = (Dypnsapi20170525ns as any).default || Dypnsapi20170525ns;
> ```
> 实现时按实际 d.ts 调整一次。`SendSmsVerifyCodeRequest`/`CheckSmsVerifyCodeRequest` 为命名 export，保持具名 import。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx jest test/user-dypnsSms.test.ts`
Expected: PASS（6 用例）。

- [ ] **Step 5: Commit**

```bash
git add src/modules/user/service/dypnsSms.ts test/user-dypnsSms.test.ts
git commit -s -m "feat(sms): add DYPNS send+check service with unit tests"
```

---

## Task 3: config 加 `dypns` 配置块（读 env）

**Files:**
- Modify: `src/modules/user/config.ts`

- [ ] **Step 1: 在 config.ts 的 return 对象内加 dypns 块**

在 `sms: { timeout: 60 * 3 }` 之后、`jwt:` 之前（或 return 对象任意平级位置）追加：

```ts
    // 阿里云 DYPNS（号码认证服务）—— 发送/校验短信验证码
    // 凭据走环境变量，不进仓库；缺省时 service 启动会用默认链
    dypns: {
      accessKeyId: process.env.DYPNS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.DYPNS_ACCESS_KEY_SECRET || '',
      signName: process.env.DYPNS_SIGN_NAME || '',
      templateCode: process.env.DYPNS_TEMPLATE_CODE || '',
      templateParam: process.env.DYPNS_TEMPLATE_PARAM || '{"min":"5"}',
      endpoint: process.env.DYPNS_ENDPOINT || 'dypnsapi.aliyuncs.com',
    },
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`（或 `npm run lint`）
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/modules/user/config.ts
git commit -s -m "feat(sms): add dypns config block reading env vars"
```

---

## Task 4: 改造 `login.ts` 接入 DYPNS（不碰 sms.ts）

**Files:**
- Modify: `src/modules/user/service/login.ts`

- [ ] **Step 1: 注入新 service**

在 `login.ts` 顶部 import 区追加：

```ts
import { UserDypnsSmsService } from './dypnsSms';
```

在 class `UserLoginService` 内、现有 `@Inject() userSmsService`（约 38-39 行）之后追加（**保留** userSmsService 注入不动，sms.ts 不被破坏）：

```ts
  @Inject()
  dypnsSmsService: UserDypnsSmsService;
```

- [ ] **Step 2: 改 `smsCode` 方法**

把 `smsCode` 方法体（47-54）中这一行：

```ts
    await this.userSmsService.sendSms(phone);
```

替换为：

```ts
    await this.dypnsSmsService.send(phone);
```

完整方法（改造后）：

```ts
  async smsCode(phone, captchaId, code) {
    // 1、检查图片验证码  2、发送短信验证码（阿里云 DYPNS）
    const check = await this.baseSysLoginService.captchaCheck(captchaId, code);
    if (!check) {
      throw new CoolCommException('图片验证码错误');
    }
    await this.dypnsSmsService.send(phone);
  }
```

- [ ] **Step 3: 改 `phoneVerifyCode` 方法**

把 `phoneVerifyCode` 方法体（61-69）中这一段：

```ts
    const check = await this.userSmsService.checkCode(phone, smsCode);
    if (check) {
      return await this.phone(phone);
    } else {
      throw new CoolCommException('验证码错误');
    }
```

替换为：

```ts
    const pass = await this.dypnsSmsService.check(phone, smsCode);
    if (pass) {
      return await this.phone(phone);
    } else {
      throw new CoolCommException('验证码错误或已过期');
    }
```

- [ ] **Step 4: 类型检查 + 单测回归**

Run: `npx tsc --noEmit -p tsconfig.json && npx jest`
Expected: 无类型错误；全部测试 PASS（含 Task 2 的 dypnsSms 单测与原有 test/）。

- [ ] **Step 5: Commit**

```bash
git add src/modules/user/service/login.ts
git commit -s -m "feat(sms): route smsCode/phoneVerifyCode to DYPNS service"
```

---

## Task 5: 环境变量配置 + 启动

**Files:**
- Create: `.env`（**不进仓库**；如仓库已有 `.env` 加载机制则编辑之）

- [ ] **Step 1: 创建/编辑 `.env`**

在仓库根创建 `.env`（若已存在则追加）：

```ini
DYPNS_ACCESS_KEY_ID=你的AccessKeyId
DYPNS_ACCESS_KEY_SECRET=你的AccessKeySecret
DYPNS_SIGN_NAME=速通互联验证码
DYPNS_TEMPLATE_CODE=100001
DYPNS_TEMPLATE_PARAM={"min":"5"}
DYPNS_ENDPOINT=dypnsapi.aliyuncs.com
```

> 用真实凭据替换占位值。若用 RAM Role / ECS 实例元数据（无 AK 方式），可只设 `SIGN_NAME`/`TEMPLATE_CODE`，留空 `ACCESS_KEY_*`——service `@Init` 会走 `@alicloud/credentials` 默认链（读取 env `ALIBABA_CLOUD_ACCESS_KEY_ID`/`ALIBABA_CLOUD_ACCESS_KEY_SECRET` 或实例元数据）。

- [ ] **Step 2: 确认 `.gitignore` 含 `.env`**

Run: `git check-ignore -v .env || echo "(NOT ignored — 必须加入 .gitignore)"`
Expected: 命中 ignore 规则。若未忽略，在 `.gitignore` 追加 `.env` 并提交。

- [ ] **Step 3: 确认 midway 加载 `.env`**

cool-admin dev 脚本 `NODE_ENV=local mwtsc ... --run @midwayjs/mock/app.js`。确认 midway 启动时读取 `.env`：
- 若 cool-admin 已集成 dotenv（很多版本默认有），`.env` 自动加载。
- 若未集成：在 `configuration.ts`（或入口）顶部 `import 'dotenv/config';` 并 `npm i -D dotenv`；或改用启动前 `export DYPNS_*=...`。

实现时验证：在 `dypnsSms.ts` 的 `init()` 末尾临时 `console.log('[dypns] signName=', this.config?.signName)`，启动后端确认非空，验证通过后删除日志。

- [ ] **Step 4: Commit（仅 `.gitignore` 若有改动；`.env` 不提交）**

```bash
git add .gitignore  # 若改动
git commit -s -m "chore(sms): ensure .env is gitignored"
```

---

## Task 6: 端到端 curl 验证

前置：后端已在 `:8001` 跑（`npm run dev`），`.env` 已配真实 DYPNS 凭据。

- [ ] **Step 1: 获取图形验证码**

Run: `curl -s "http://127.0.0.1:8001/app/user/login/captcha?width=120&height=40" | python3 -m json.tool`
Expected: 返回 `{ "code":1000, "data":{ "captchaId":"...", "data":"<base64 svg>" } }`。记下 `captchaId`，并把 `data` 的 base64 在浏览器渲染出图形码（或用 OCR）读出 4 位 `code`。

- [ ] **Step 2: 发送短信验证码**

Run（替换 `{phone}`/`{captchaId}`/`{code}`）：
```bash
curl -s -X POST "http://127.0.0.1:8001/app/user/login/smsCode" \
  -H "Content-Type: application/json" \
  -d '{"phone":"{phone}","captchaId":"{captchaId}","code":"{code}"}' | python3 -m json.tool
```
Expected: `{ "code":1000, "data":null }`，且真实手机收到短信验证码。
- 若返回 `"未配置短信插件"` → Task 4 未生效（仍走旧 sms.ts），检查 login.ts 改动。
- 若返回阿里云错误（`isv.*`）→ 凭据/签名/模板/手机号格式问题，看 `message` 与阿里云诊断地址。

- [ ] **Step 3: 验证码登录**

Run（替换 `{phone}`/`{smsCode}` 为收到的短信码）：
```bash
curl -s -X POST "http://127.0.0.1:8001/app/user/login/phone" \
  -H "Content-Type: application/json" \
  -d '{"phone":"{phone}","smsCode":"{smsCode}"}' | python3 -m json.tool
```
Expected: `{ "code":1000, "data":{ "token":"...", "refreshToken":"...", "expire":86400, "refreshExpire":2592000 } }`。
- 错误短信码 → `{ "code":..., "message":"验证码错误或已过期" }`（验证 Task 4 改造）。

- [ ] **Step 4: 用 token 取个人信息**

Run（替换 `{token}`）：
```bash
curl -s "http://127.0.0.1:8001/app/user/info/person" -H "Authorization: {token}" | python3 -m json.tool
```
Expected: 返回 `UserInfo`（首次登录则刚建号，`nickName` 为脱敏手机号）。

- [ ] **Step 5: 重复登录校验失效**

立刻用同一 smsCode 再登一次 → 应失败（阿里云验证码单次有效）。

- [ ] **Step 6: 回归现有测试**

Run: `npx jest`
Expected: 全部 PASS。

- [ ] **Step 7: 联调记录（可选 commit）**

若联调中发现字段名/返回结构与计划假设不符（如 `verifyResult` 字段位置），修正 `dypnsSms.ts` 并补单测，再提交：

```bash
git add src/modules/user/service/dypnsSms.ts test/user-dypnsSms.test.ts
git commit -s -m "fix(sms): align DYPNS response parsing with actual SDK"
```

---

## Self-Review（写计划后自查结果）

- **Spec 覆盖**：设计文档 §11.1-11.4 → Task 1-6 覆盖（SDK 安装 / service send+check / 配置读 env / login.ts 两方法接入 / env 配置 / curl 验证）。`sms.ts` 明确未列入修改文件（File Structure 标注 NOT modify）。
- **占位符**：无。`dypnsSms.ts` 与 `login.ts` 改动给出完整代码；`.env` 给出真实字段名（值由执行者填）。
- **类型/方法一致**：`UserDypnsSmsService.send(phone)/check(phone,code)`、`@Config('module.user.dypns')`、config 字段名 `signName/templateCode/templateParam/endpoint/accessKeyId/accessKeySecret` 在 service/config/test 三处一致；login.ts 调用 `dypnsSmsService.send/check` 与 service 签名一致。
- **已知需运行时核对**（非占位，已在 Task 2/6 标注）：SDK d.ts 的 default import 形态、`SendSmsVerifyCodeRequest`/`CheckSmsVerifyCodeRequest` 字段名（`phoneNumber`/`verifyCode`）、`verifyResult` 在响应中的路径（`body.model.verifyResult`）。
