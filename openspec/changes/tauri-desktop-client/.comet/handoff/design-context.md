# Comet Design Handoff

- Change: tauri-desktop-client
- Phase: design
- Mode: compact
- Context hash: c0fe5414cf0e99f35f306c484748f12dc100a369ff57bbcb2036422680825607

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/tauri-desktop-client/proposal.md

- Source: openspec/changes/tauri-desktop-client/proposal.md
- Lines: 1-44
- SHA256: a4c1289dc1f9db833d3780b2c277a5efd94bf779eb6edd0d1ed52b9ba79c2b84

```md
## Why

Vibe-Trading 当前只能通过 Docker 或本地手动起双服务(`scripts/dev`)运行,要求用户具备 Python、Node、Docker 等环境与依赖,门槛高、不适合作为终端用户产品分发。需要一个**双击即用、零依赖安装**的桌面客户端:把现有 Python 后端与 Web UI 原样封装进一个 Tauri 应用,用户无需了解任何技术细节即可在 macOS / Windows 上使用。

本变更**只做封装与启动编排,不重写任何后端 / 前端业务逻辑**。

## What Changes

- 新增 `src-tauri/`:Tauri(Rust)应用核心,负责在启动时拉起内嵌的 Python 后端作为 sidecar 子进程、选取空闲端口、轮询健康检查、就绪后把 webview 指向 `http://127.0.0.1:<port>`,并在应用退出时干净终止 sidecar 进程。
- 新增 **可重定位 Python 运行时打包流程**:基于 python-build-standalone 制作自包含运行时,预装 `agent/requirements.txt` 全部依赖(排除 weasyprint),连同 `agent/` 源码、`frontend/dist`、`agent/.env` 一并打包进应用资源,实现完全离线、开箱即用。
- 新增 **双平台构建与打包脚本**:macOS 产出 `.app`/`.dmg`,Windows 产出 `.msi`/`.exe`;复用现有 `frontend` 的 `npm run build` 产物与 `agent/` 源码,不引入新的业务依赖。
- **桌面运行模式约束**:后端绑定 `127.0.0.1`(区别于现有 CLI 默认的 `0.0.0.0`),仅本机访问;端口动态分配以规避冲突。
- **PDF 报告降级为 HTML**:打包时不安装 weasyprint 及其系统原生库(cairo/pango/gdk-pixbuf)。`agent/src/shadow_account/reporter.py` 已内建 try/except 降级路径(`reporter.py:304`),weasyprint 不可用时自动产出 HTML —— **零业务代码改动**。
- 用户状态(`~/.vibe-trading/`)继续保存在家目录,不在应用包内,保证升级/重装不丢数据;配置沿用 `.env` 既有搜索顺序(`~/.vibe-trading/.env` → 打包的 `agent/.env` → `$CWD/.env`),用户可在家目录覆盖。

### 不拆分说明
本变更覆盖 macOS 与 Windows 双平台,但属于**单一内聚能力**:两个平台共享同一套 Rust 启动编排、sidecar 生命周期管理、前端复用与 `.env` 加载逻辑,差异仅在 Python 运行时打包细节与 CI 构建矩阵。两个平台无法独立交付(共享核心代码),拆分会产生大量重复的 proposal/design。因此保持单 change,在 tasks 中按平台分组并标注 **macOS 优先验证**。

### 非目标(本次不做)
- 不重写后端 / 前端业务逻辑(仅封装与启动编排)。
- 不移除报告功能(仅降级 PDF→HTML)。
- 不内置本地 LLM(沿用 `agent/.env` 的 OpenRouter 云端模型)。
- 不做应用自动更新(auto-update)机制 —— 可作为后续 change。
- 不做应用内 `.env` 编辑 UI(用户仍可手动编辑 `~/.vibe-trading/.env`)。
- 不做代码签名 / 公证(macOS 首次需右键打开;Windows 可能触发 SmartScreen 警告)—— 作为已知限制,可后续单独处理。

## Capabilities

### New Capabilities
- `desktop-shell`: Tauri 桌面应用外壳与 Python 后端 sidecar 的生命周期编排 —— 端口选择、进程拉起、健康检查、就绪后加载 webview、退出时进程清理、启动期加载反馈与启动失败处理。
- `python-runtime-bundling`: 可重定位 Python 运行时的制作与依赖预装流程 —— 运行时来源、依赖安装(排除 weasyprint)、原生扩展可重定位性验证、资源裁剪,以及运行时与 `agent/` 源码、`frontend/dist`、`agent/.env` 的资源装配。
- `desktop-packaging-build`: 双平台(macOS / Windows)构建与打包产物定义 —— 前端构建复用、Tauri bundle 配置、产物格式、构建环境约束(跨平台构建需各自平台或 CI 矩阵)。

### Modified Capabilities
<!-- 无:openspec/specs/ 为空,且本变更不修改任何已有 spec 级行为。 -->

## Impact

- **新增代码 / 资源**:`src-tauri/`(Rust 源码 + `tauri.conf.json` + 图标资源)、Python 运行时打包脚本(`scripts/` 下新增)、构建脚本。
- **复用不改动**:`agent/`(后端业务)、`frontend/src/`(前端业务,仅复用 `frontend/dist` 构建产物)、`~/.vibe-trading/` 状态结构。
- **依赖**:新增 Rust / Tauri 工具链(构建期),python-build-standalone(打包期);运行期不要求用户安装任何依赖。打包依赖集 = `agent/requirements.txt` 减去 weasyprint。
- **构建环境**:macOS 包需在 macOS 构建,Windows 包需在 Windows 构建(无法交叉编译);项目已有 `.github/`,可用 GitHub Actions 矩阵分别产出。
- **运行行为差异**:后端监听地址由 `0.0.0.0` 变为 `127.0.0.1`、端口由固定 8899 变为动态分配(仅桌面运行模式,不影响现有 CLI/Docker 用法)。
- **已知限制**:不签名导致的首次启动安全提示;应用体积约 800MB–1.5GB(完整内嵌 Python + 科学计算依赖)。
```

## openspec/changes/tauri-desktop-client/design.md

- Source: openspec/changes/tauri-desktop-client/design.md
- Lines: 1-73
- SHA256: 0489aff547aa1401897d5781d55a466ac88b8bc9dbb012fea5a1c1448555c8f4

```md
## Context

Vibe-Trading 现状:Python(FastAPI + uvicorn)后端通过 `vibe-trading serve` 启动,生产模式下用 `SPAStaticFiles` 把 `frontend/dist` 挂载到 `/`(`agent/api_server.py:3100-3118`),即**后端本身就是 Web 服务器**。前端所有 API 请求走同源相对路径(`frontend/src/lib/api.ts:3` `BASE=""`)。用户状态统一落在 `~/.vibe-trading/`,`.env` 搜索顺序为 `~/.vibe-trading/.env → agent/.env → $CWD/.env`(`agent/src/providers/llm.py:246`)。

当前分发依赖 Docker 或本地手动起服务,要求用户具备 Python/Node/Docker 环境。目标是封装成 macOS/Windows 双平台、零依赖、双击即用的 Tauri 桌面客户端,**不重写任何业务逻辑**。

约束:
- 完整内嵌 Python(已确认),体积 ~800MB–1.5GB 可接受。
- PDF 报告降级为 HTML(已确认),`reporter.py:304` 已内建降级,无需改代码。
- 后端绑 `127.0.0.1`、端口动态分配(仅桌面模式)。
- 无法交叉编译,双平台需各自构建环境。

## Goals / Non-Goals

**Goals:**
- 双击即用、完全离线、零依赖安装的 macOS + Windows 桌面客户端。
- 后端与 Web UI 原样复用,封装层与业务层解耦。
- sidecar 生命周期可靠:端口选择、健康检查、就绪加载、退出清理。
- 用户状态在家目录持久,升级不丢数据;用户可覆盖配置。

**Non-Goals:**
- 不重写后端 / 前端业务逻辑。
- 不做 auto-update、不做应用内配置 UI、不内置本地 LLM。
- 不做代码签名 / 公证(列为已知限制)。
- 不保留 PDF 渲染(降级 HTML)。

## Decisions

### D1: webview 指向后端托管的 UI,而非 Tauri 静态托管前端
后端生产模式已托管 `frontend/dist` 且前端走同源相对路径。让 webview 直接指向 `http://127.0.0.1:<port>`,前端零改动、零跨域、无需注入 API base。
- **Alternative**:Tauri 用 `frontendDist` 直接托管前端、API 指向 sidecar。被否:前端 `BASE=""` 同源假设会破裂,需改前端并处理 CORS,违背"不改业务"。

### D2: Python 运行时用 python-build-standalone,作为 Tauri `resources` 打包
完整内嵌一份预装依赖的可重定位 Python。打包整目录用 Tauri `resources`(而非仅适合单二进制的 `externalBin`),Rust 侧用 `Command` spawn `resources/python/bin/python`(Windows 为 `python.exe`)运行 `agent` 的 serve 入口。
- **Alternative A**:PyInstaller/Nuitka 冻结。被否:scipy/duckdb/weasyprint 等重原生依赖隐藏导入与动态库易踩坑、脆弱难维护。
- **Alternative B**:首启 uv 联网引导。被否:违背"开箱即用 / 完全离线"。

### D3: 依赖预装排除 weasyprint
打包时安装 `requirements.txt` 但剔除 weasyprint。`reporter.py` 已 try/except 降级到 HTML(`reporter.py:304`),零代码改动即满足"降级 HTML"。同时省去 vendoring cairo/pango 原生库的复杂度。

### D4: 端口动态分配 + 健康检查门控加载
Rust 侧先探测空闲端口(绑定 `127.0.0.1:0` 取系统分配,或从 8899 起递增探测),以 `--host 127.0.0.1 --port <port>` 启动后端;轮询 `/health`(`scripts/dev` 已有同款就绪探测模式)通过后再加载 webview,期间显示加载态;超时显示可读错误。

### D5: sidecar 进程生命周期与平台差异
- macOS/Linux:用进程组(`start_new_session` / setsid 风格),退出时按组终止 —— 复用 `scripts/dev:69-90` 同款思路。
- Windows:无 POSIX 进程组,用 Job Object 关联子进程(随父进程结束自动终止)或退出时 `taskkill /T`。
- Tauri 监听窗口关闭 / `RunEvent::ExitRequested`,统一触发清理。

### D6: 配置与状态沿用既有机制
打包 `agent/.env` 作兜底配置;`.env` 既有搜索顺序使用户可在 `~/.vibe-trading/.env` 覆盖。首启 onboarding 仅当 `.env` 缺失才触发(`cli/main.py:253`),已打包 `.env` 故真正开箱即用。状态目录 `~/.vibe-trading/` 不进应用包。

### D7: 双平台构建走 CI 矩阵
项目已有 `.github/`。用 GitHub Actions macOS + Windows runner 分别构建产物,文档明确"不可交叉编译"约束。本地可单平台(macOS 优先)验证。

## Risks / Trade-offs

- [python-build-standalone 装重型科学包后可重定位性未知:scipy/sklearn 的 BLAS 链接、duckdb `.so/.pyd` 的 rpath 在迁移路径后可能 import 失败] → design 阶段先打 spike 实测;提供原生扩展导入冒烟测试(spec 已要求)。**这是头号风险,brainstorming 须优先攻克。**
- [应用体积 800MB–1.5GB] → 资源裁剪(去 tests/`__pycache__`/`dist-info`);接受为内嵌完整 Python 的必然代价。
- [Windows 进程清理不彻底致残留后端] → Job Object 方案;补进程清理验收测试。
- [不签名导致首次启动安全提示] → 文档说明 macOS 右键打开 / Windows SmartScreen "仍要运行";列为已知限制。
- [无法交叉编译] → CI 矩阵双平台分别构建。
- [动态端口 / 健康检查竞态致偶发加载失败] → 就绪轮询 + 超时 + 可读错误兜底。

## Migration Plan

封装层为新增,不改动现有运行方式,无数据迁移。回滚 = 不分发桌面包,Docker/CLI 路径不受影响。交付顺序:先 macOS 打通端到端(含可重定位性 spike),再补 Windows 差异(进程清理 / 运行时打包)。

## Open Questions

1. python-build-standalone 具体发行版/版本与各平台架构(mac arm64+x64 是否都要?Windows x64)—— design/brainstorming 阶段定。
2. 依赖预装方式:在目标平台直接 `pip install` 进内嵌 site-packages,还是用 `uv` 锁定后装入 —— 影响可重现性,brainstorming 决策。
3. 加载态 UI 形态:Tauri 原生 splash 窗口 vs. 简单 HTML 加载页 —— 实现细节,可在 build 阶段定。
4. 是否需要 mac 双架构(universal / 分架构产物)—— 取决于分发目标,可延后。
```

## openspec/changes/tauri-desktop-client/tasks.md

- Source: openspec/changes/tauri-desktop-client/tasks.md
- Lines: 1-49
- SHA256: 49691c8c32484c8e0ed18a916d2188d3a217890392e021c413828307dbbe3157

```md
# Tasks: tauri-desktop-client

> 顺序:先攻克头号风险(可重定位性 spike)→ macOS 端到端打通 → 补 Windows 差异 → 双平台构建与验收。
> 平台标注:【mac】仅 macOS,【win】仅 Windows,【双】两平台共用。

## 1. 可重定位性 Spike(头号风险,先行验证)

- [ ] 1.1 【mac】选定 python-build-standalone 发行版/版本与架构(mac arm64,确认是否需 x64),下载并解压一份可重定位运行时
- [ ] 1.2 【mac】在该运行时中 `pip install` `agent/requirements.txt`(排除 weasyprint),记录安装方式(直接 pip vs uv 锁定)
- [ ] 1.3 【mac】把运行时整体移动到另一路径(模拟不同安装目录/用户名),编写并运行原生扩展导入冒烟测试:`numpy / scipy / scikit-learn / duckdb / pandas / Pillow / matplotlib` 均能 import 且无 BLAS/rpath 链接错误
- [ ] 1.4 【mac】在迁移后的运行时中以子进程启动 `vibe-trading serve --host 127.0.0.1 --port <port>`,确认 `/health` 可达、SPA 静态资源可加载
- [ ] 1.5 记录 spike 结论与任何需要的 rpath/路径修复手段;若不可重定位,回到 design 调整方案(阻塞后续)

## 2. Tauri 脚手架与项目结构【双】

- [ ] 2.1 初始化 `src-tauri/`(Tauri 配置 + Rust crate + 图标占位),确认 Rust/Tauri 工具链可构建空壳应用
- [ ] 2.2 编写 `tauri.conf.json`:窗口配置、`resources` 声明(Python 运行时目录、`agent/`、`frontend/dist`、`agent/.env`)、bundle 标识
- [ ] 2.3 约定资源目录布局与 Rust 侧资源路径解析(开发态 vs 打包态),确保能定位内嵌 python 与 serve 入口

## 3. Sidecar 启动编排(desktop-shell)【双,mac 先实现】

- [ ] 3.1 实现空闲端口选取(`127.0.0.1:0` 系统分配或从 8899 起探测)
- [ ] 3.2 实现 spawn Python sidecar:以内嵌运行时运行 serve,传入 `--host 127.0.0.1 --port <port>`,设置工作目录与必要环境变量(PYTHONPATH 指向 `agent/`)
- [ ] 3.3 实现 `/health` 轮询 + 超时门控;就绪后将 webview 指向 `http://127.0.0.1:<port>`
- [ ] 3.4 实现启动期加载态 UI(splash 或加载页),避免空白窗口
- [ ] 3.5 实现就绪超时的可读错误提示与退出途径
- [ ] 3.6 【mac】实现退出时进程清理(进程组/setsid 风格),验证关闭应用后无残留 Python 进程

## 4. macOS 端到端打通与打包(desktop-packaging-build)

- [ ] 4.1 编写 macOS 打包脚本:构建 `frontend`(`npm run build`)→ 准备内嵌运行时与资源 → 资源裁剪(去 tests/`__pycache__`/`*.dist-info`)
- [ ] 4.2 产出 `.app` 并验证:全新/无系统 Python 环境下双击启动 → 加载态 → 后端就绪 → UI 加载 → 可正常对话/回测
- [ ] 4.3 验证 `agent/.env` 兜底生效、`~/.vibe-trading/` 首启自动创建、状态在重启后保留
- [ ] 4.4 验证报告降级:生成影子账户报告 → weasyprint 缺失 → 自动产出 HTML 不报错
- [ ] 4.5 产出可分发 `.dmg`

## 5. Windows 差异适配(desktop-shell + bundling)【win】

- [ ] 5.1 选定/制作 Windows x64 python-build-standalone 运行时并预装依赖(排除 weasyprint),跑 1.3 同款导入冒烟测试
- [ ] 5.2 适配 Rust 侧:`python.exe` 路径、路径分隔符、spawn 细节
- [ ] 5.3 实现 Windows 进程清理:Job Object 关联子进程(或退出时 `taskkill /T`),验证关闭后无残留进程(含异常退出场景)
- [ ] 5.4 编写 Windows 打包脚本,产出 `.msi`/`.exe` 并完成与 4.2–4.4 等价的端到端验证

## 6. 双平台构建与收尾

- [ ] 6.1 配置 GitHub Actions 矩阵(macOS + Windows runner)分别构建产物,文档明确"无法交叉编译"约束
- [ ] 6.2 验证桌面运行模式不破坏现有用法:`vibe-trading serve` / Docker 默认绑定与端口行为不受影响
- [ ] 6.3 编写用户向文档:安装、首次启动安全提示处理(mac 右键打开 / Windows SmartScreen)、状态与配置位置说明
- [ ] 6.4 汇总已知限制(体积、未签名、PDF→HTML 降级)到发布说明
```

## openspec/changes/tauri-desktop-client/specs/desktop-packaging-build/spec.md

- Source: openspec/changes/tauri-desktop-client/specs/desktop-packaging-build/spec.md
- Lines: 1-33
- SHA256: 7dbc628ce7778c2fe43ae4821804f0f930aea807e379b76c787f3bf335d5a657

```md
## ADDED Requirements

### Requirement: 双平台打包产物
构建流程 SHALL 为 macOS 产出 `.app` / `.dmg`,为 Windows 产出 `.msi` / `.exe`,两者均内嵌对应平台的 Python 运行时与全部资源,实现双击安装即用。

#### Scenario: macOS 产物可安装运行
- **WHEN** 在 macOS 上完成构建
- **THEN** 产出 `.app`(及可分发的 `.dmg`),用户安装后双击即可启动,无需额外依赖

#### Scenario: Windows 产物可安装运行
- **WHEN** 在 Windows 上完成构建
- **THEN** 产出 `.msi` 或 `.exe` 安装包,用户安装后双击即可启动,无需额外依赖

### Requirement: 复用现有前端构建产物
构建流程 SHALL 复用 `frontend` 现有的 `npm run build` 产物(`frontend/dist`)作为 UI,不引入新的前端业务依赖或改写前端业务代码。

#### Scenario: 前端构建复用
- **WHEN** 执行桌面应用构建
- **THEN** 构建使用 `frontend/dist`(由现有 `npm run build` 生成)作为打包的 Web UI,前端业务代码无改动

### Requirement: 跨平台构建环境约束
构建流程 SHALL 明确记录"macOS 包须在 macOS 构建、Windows 包须在 Windows 构建"这一约束(无法交叉编译),并 SHOULD 提供基于 CI 矩阵的双平台产出路径。

#### Scenario: 构建环境匹配目标平台
- **WHEN** 需要产出某平台的安装包
- **THEN** 在该平台对应的构建环境(本机或 CI runner)上执行构建,文档清晰说明此约束

### Requirement: 桌面运行模式不破坏现有用法
桌面打包 SHALL 不改变现有 CLI / Docker 的运行方式;`0.0.0.0` 绑定与固定端口等行为变更仅作用于桌面运行模式。

#### Scenario: 现有 CLI 行为不受影响
- **WHEN** 用户仍以 `vibe-trading serve` / Docker 方式运行项目
- **THEN** 其默认绑定地址与端口行为保持原样,不受桌面封装改动影响
```

## openspec/changes/tauri-desktop-client/specs/desktop-shell/spec.md

- Source: openspec/changes/tauri-desktop-client/specs/desktop-shell/spec.md
- Lines: 1-67
- SHA256: 81f455411fc3e059c448caf1cf25b44c243fdad4173686dd64b25940025979b3

```md
## ADDED Requirements

### Requirement: 应用启动时编排 Python 后端 sidecar
桌面应用 SHALL 在启动时拉起内嵌的 Python 后端作为 sidecar 子进程,通过 `vibe-trading serve` 入口启动 FastAPI 服务,并在服务就绪后才向用户展示 Web UI。

#### Scenario: 正常启动并加载 UI
- **WHEN** 用户在已安装应用且无其他实例运行时双击启动
- **THEN** 应用拉起 Python sidecar,轮询后端 `/health` 直至返回成功,随后 webview 指向 `http://127.0.0.1:<port>` 并加载现有 Web UI

#### Scenario: 启动期向用户提供反馈
- **WHEN** Python sidecar 正在启动、后端尚未就绪
- **THEN** 应用显示加载状态(而非空白窗口),直至健康检查通过或超时

### Requirement: 动态端口分配
桌面应用 SHALL 为后端动态选取一个可用的本机端口,而非固定使用 8899,以规避端口冲突。

#### Scenario: 默认端口被占用
- **WHEN** 启动时 8899 或首选端口已被其他进程占用
- **THEN** 应用自动选取另一个空闲端口并以该端口启动后端,应用仍正常启动

#### Scenario: webview 与后端端口一致
- **WHEN** 后端在动态选取的端口 `<port>` 上就绪
- **THEN** webview 加载的地址与该 `<port>` 一致,前端 API 请求(同源相对路径)指向同一后端

### Requirement: 后端仅绑定本机回环地址
桌面运行模式下,后端 SHALL 绑定 `127.0.0.1`,不得绑定 `0.0.0.0` 或对外暴露端口。

#### Scenario: 后端不对局域网暴露
- **WHEN** 应用启动后端
- **THEN** 后端监听地址为 `127.0.0.1:<port>`,同一网络中的其他设备无法访问该后端

### Requirement: 退出时清理 sidecar 进程
桌面应用 SHALL 在主窗口关闭或应用退出时干净终止 Python sidecar 子进程及其派生进程,不留残留进程。

#### Scenario: 关闭应用终止后端
- **WHEN** 用户关闭应用主窗口
- **THEN** Python sidecar 进程被终止,关闭后系统中不存在由本应用启动的残留 Python 后端进程

#### Scenario: 异常退出也清理
- **WHEN** 应用进程异常终止(崩溃或被强制结束)
- **THEN** 在平台能力允许范围内,sidecar 子进程随之终止(如通过进程组 / Job Object 关联),不长期残留

### Requirement: 启动失败的可见错误处理
当后端在超时时间内未能就绪时,桌面应用 SHALL 向用户显示可读的错误信息,而非静默卡在加载态或崩溃。

#### Scenario: 后端就绪超时
- **WHEN** Python sidecar 启动后,健康检查在约定超时时间内始终未通过
- **THEN** 应用展示明确的启动失败提示(含可定位问题的基本信息),并提供退出途径

### Requirement: 首启与升级时准备可写运行目录
由于后端将数据写入相对代码目录的硬编码位置(`runs`/`sessions`/`uploads`/`.swarm/runs`),而应用 bundle 在 macOS / Windows 上为只读,桌面应用 SHALL 在启动后端前把只读 bundle 中的后端代码复制到一个可写运行目录,并以指向该可写副本的方式启动后端,使所有运行期写入落在可写位置。

#### Scenario: 首次启动准备可写目录
- **WHEN** 应用首次启动(可写运行目录尚不存在)
- **THEN** 应用将 bundle 中的后端代码复制到可写运行目录,并记录已安装版本标记;随后后端从该可写副本启动,`runs`/`sessions`/`uploads`/`.swarm/runs` 均创建在可写位置

#### Scenario: 升级刷新代码但保留用户数据
- **WHEN** 应用版本较已安装版本更新(版本标记不一致)
- **THEN** 应用刷新可写运行目录中的后端代码,但 SHALL 保留既有的 `runs`/`sessions`/`uploads`/`.swarm/runs` 数据子目录与用户配置,不被覆盖或删除

#### Scenario: 种入配置且不覆盖用户配置
- **WHEN** 准备可写目录时,用户家目录配置(`~/.vibe-trading/.env`)不存在
- **THEN** 应用从 bundle 的配置种子复制一份作为初始配置;若用户配置已存在,则 SHALL NOT 覆盖它

#### Scenario: 可写目录准备失败的可读错误
- **WHEN** 准备可写运行目录失败(如磁盘空间不足或权限不足)
- **THEN** 应用展示可读的错误信息(含失败路径与原因),而非静默崩溃或卡在加载态
```

## openspec/changes/tauri-desktop-client/specs/python-runtime-bundling/spec.md

- Source: openspec/changes/tauri-desktop-client/specs/python-runtime-bundling/spec.md
- Lines: 1-48
- SHA256: 60e2f841ef7ee5ae368bd84e0623bc55fa1e0a83a73f9ad7a9c59fe257911a2c

```md
## ADDED Requirements

### Requirement: 可重定位的内嵌 Python 运行时
打包流程 SHALL 产出一份自包含、可重定位的 Python 运行时(基于 python-build-standalone),使其在被放置到应用资源目录的任意安装路径后仍能正常运行,不依赖用户机器上预装的 Python。

#### Scenario: 无系统 Python 的机器上运行
- **WHEN** 应用安装在一台未安装任何 Python 的全新机器上
- **THEN** 应用使用内嵌运行时启动后端,无需用户安装 Python 或任何依赖

#### Scenario: 运行时随安装路径迁移
- **WHEN** 内嵌运行时被安装到不同的目标路径(不同用户名 / 安装目录)
- **THEN** 运行时仍能正确解析自身路径并启动,不因绝对路径写死而失败

### Requirement: 预装全部后端依赖(排除 weasyprint)
打包流程 SHALL 将 `agent/requirements.txt` 的全部依赖预装进内嵌运行时,但 SHALL 排除 weasyprint 及其系统原生库,以避免引入 cairo/pango/gdk-pixbuf 等非 pip 系统依赖。

#### Scenario: 依赖完整可导入
- **WHEN** 后端在内嵌运行时中启动
- **THEN** 除 weasyprint 外的所有声明依赖(含 numpy/scipy/scikit-learn/pandas/duckdb 等原生扩展)均可正常导入并工作

#### Scenario: 缺失 weasyprint 不阻断启动
- **WHEN** 内嵌运行时未安装 weasyprint
- **THEN** 后端正常启动,影子账户报告生成走 HTML 降级路径(由 `reporter.py` 既有 try/except 处理),不抛出未捕获异常

### Requirement: 原生扩展可重定位性验证
打包流程 SHALL 验证带原生扩展的关键依赖(至少包括 numpy、scipy、scikit-learn、duckdb、pandas、Pillow)在内嵌运行时迁移到目标路径后可成功导入。

#### Scenario: 关键原生包导入冒烟测试
- **WHEN** 在打包产物(或等价的迁移路径)中执行导入冒烟测试
- **THEN** 上述每个包均能成功 `import` 且基本调用不报动态库链接错误(如 BLAS / rpath 问题)

### Requirement: 回测子进程使用内嵌 Python 自包含
回测执行会以子进程方式选取解释器(`agent/src/core/runner.py` 在找不到项目 `.venv` 时回退到 `sys.executable`)。打包流程 SHALL 确保该回退所用的内嵌 Python 自包含,即回测子进程使用内嵌运行时即可加载全部所需依赖。

#### Scenario: 回测子进程在内嵌运行时跑通
- **WHEN** 在打包产物中触发一次回测,且运行环境无项目 `.venv`(回退到内嵌 `sys.executable`)
- **THEN** 回测子进程使用内嵌 Python 成功加载所需依赖并完成执行,不因缺失依赖或解释器不可用而失败

### Requirement: 资源装配与裁剪
打包流程 SHALL 将内嵌运行时与 `agent/` 源码、`frontend/dist`、`agent/.env` 一并装配进应用资源,并 SHALL 裁剪非必要文件(测试、`__pycache__`、`*.dist-info` 等)以控制体积。

#### Scenario: 资源完整可用
- **WHEN** 应用启动并加载资源
- **THEN** 后端能找到 `agent/` 源码与 `agent/.env`,webview 能加载 `frontend/dist`,功能完整

#### Scenario: 体积裁剪生效
- **WHEN** 完成打包
- **THEN** 产物中不包含测试目录、`__pycache__` 等非运行必需文件
```

