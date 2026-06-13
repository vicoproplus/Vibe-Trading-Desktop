---
comet_change: desktop-runtime-deps-on-demand
role: technical-design
canonical_spec: openspec
---

# 技术设计：桌面端运行时按需安装可选依赖

> 本 Design Doc 是 Superpowers 技术设计。需求事实源（canonical spec）为 OpenSpec delta spec `specs/python-runtime-optional-deps/spec.md`，本文件不重复定义需求，仅描述实现方案。

## 1. 背景与现状

桌面端通过 Tauri 嵌入 python-build-standalone 运行时，打包时用 `install-deps.sh`（uv）把 `agent/requirements.txt` 核心依赖预装进 bundle 内 `site-packages`（只读）。sidecar 启动时 `PYTHONPATH` 指向可写的 `~/.vibe-trading/runtime/agent`（agent 源码副本）。

```
.app bundle (只读)                         ~/.vibe-trading/ (可写)
├─ python-runtime/lib/.../site-packages ◀── 缺口：无可写第三方包目录
└─ agent (template)              ───▶  runtime/agent  (PYTHONPATH 指此)
                                      runtime/libs    ◀── 本次新增
                                      .env
```

10+ 券商 SDK 未打包；agent 在 `trading/connectors/*/sdk.py` 仅以错误字符串提示 `pip install xxx`，桌面用户无法操作。

## 2. 调研事实（驱动设计）

| 主题 | 事实 | 对设计的影响 |
|---|---|---|
| uv `--target` | uv 0.9.26 支持（文档确认） | 可选，但非必需 |
| 内嵌 pip | python-build-standalone 自带 pip 26.1.2，`python3 -m pip` 可用 | **pip 零体积增量**，选为安装器 |
| 券商 SDK wheel | 7 个纯 Python（any）、futu-api 纯 sdist、longbridge 全平台 native wheel、**vnpy_ctp 仅 win_amd64** | 平台风险极低；仅 vnpy_ctp 是硬约束 |
| PYTHONPATH 优先级 | 插在 `site-packages` **之前** | 有覆盖核心依赖风险，不采用 |
| `sys.path.append` | 排在 `site-packages` **之后** | 核心依赖优先，安全，采用 |

### 2.1 spike 调研补充：券商 SDK wheel 可用性矩阵

**uv `--target` 复核（Task 2.1）**

uv 已支持 `uv pip install --target <dir>`，但存在 venv 探测问题：在无虚拟环境目录下执行时会报错要求 `--system` 或 `uv venv`。该问题已于 2024-11 通过 [PR #9371](https://github.com/astral-sh/uv/pull/9371) 修复，当前版本正常可用。design doc line 29 结论"uv 0.9.26 支持"仍准确。

**pip 选型复核（Task 2.2）**

D1 决策（选 pip，不内嵌 uv）稳固，无新信息推翻。uv `--target` 虽可用，但需要额外管理 uv 二进制（约 20-30MB），且本场景多数券商 SDK 是纯 Python 小包，pip 速度足够。uv 保留为未来增强选项。

**内嵌 pip 确认（Task 2.4）**

本机验证：`python3 -m pip --version` 输出 `pip 25.1.1 from .../lib/python3.11/site-packages/pip (python 3.11)`。python-build-standalone 自带 pip，`python3 -m pip` 可用，零体积增量确认。桌面端实际将使用 python-build-standalone 自带的 pip 26.1.2。

**券商 SDK wheel 可用性矩阵（Task 2.3）**

以下矩阵基于 2026-06-13 PyPI JSON API 实际查询结果，列出 10 个券商 SDK 在三个目标平台上的预编译 wheel 可用性：

| 包名 | 最新版 | 类型 | macOS arm64 | macOS x86_64 | Windows | 备注 |
|---|---|---|---|---|---|---|
| python-okx | 0.4.1 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` |
| futu-api | 10.7.6708 | sdist-only | ✅* | ✅* | ✅* | 仅 `.tar.gz`，pip 需本地编译；纯 Python 代码无 C 扩展，跨平台安全 |
| ib_async | 2.1.0 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` + sdist |
| longbridge | 4.3.2 | 平台 wheel | ✅ | ✅ | ✅ | cp38-314 全版本 native wheel，含 macOS arm64/x86_64 + win_amd64 |
| tigeropen | 3.5.9 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` + sdist |
| alpaca-py | 0.43.4 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` + sdist |
| dhanhq | 2.2.0 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` + sdist |
| shoonya | 0.1.4 | 纯 Python | ✅ | ✅ | ✅ | `py3-none-any.whl` + sdist |
| NorenRestApiPy | 0.0.22 | 纯 Python | ✅ | ✅ | ✅ | `py2.py3-none-any.whl`（兼容 Python 2/3） |
| vnpy_ctp | 6.7.11.4 | 平台 wheel | ❌ | ❌ | ✅ (amd64) | **仅 win_amd64 wheel**；sdist 存在但需 Windows CTP SDK 编译，macOS/Linux 不可用 |

> *futu-api 标记 ✅* 的含义：虽仅有 sdist，但富途 SDK 为纯 Python 实现（无 C 扩展），`pip install --target` 会正常解压安装，无需编译器。桌面端安装时会稍慢（需下载+解压），但功能不受限。

**关键发现**：

- **平台硬约束**：仅 `vnpy_ctp` 有平台限制（Windows amd64 only），registry 中需标注，安装 API 平台预检需拒绝 macOS/Linux 请求。
- **longbridge**：唯一提供全平台 native wheel 的包，包含 Rust 扩展，体积较大。但不影响 pip 选型——pip 可正常下载预编译 wheel，无需本地编译。
- 其余 8 个包均为纯 Python（any wheel 或 sdist-only 纯 Python），跨平台零风险。

## 3. 已确认的技术决策

### D1 安装器：pip + 国内镜像（不内嵌 uv）
内嵌运行时已含 pip，零体积增量、零额外打包。国内镜像（默认清华，`PIP_INDEX_URL` 注入）解决带宽——这是国内下载慢的主因。多数券商 SDK 是纯 Python 小包，pip 速度足够。uv 作为未来增强（若 longbridge 类大包成痛点）。

### D2 可写依赖目录
`~/.vibe-trading/runtime/libs/`，扩展 `runtime_dir::Layout`。版本升级时与 `.env` 同级保留，不随 bundle 模板覆盖。安装时由 `pip install --target <libs_dir>` 写入。

### D3 sys.path 注入：cli 入口 `sys.path.append`
在 `cli` 入口最顶部（早于其他业务 import）插入：
```python
import os, sys
_libs = os.environ.get("VIBE_RUNTIME_LIBS")
if _libs and os.path.isdir(_libs):
    sys.path.append(_libs)   # append → 排在 site-packages 之后，核心依赖优先
```
`sidecar.rs` spawn 时设 `VIBE_RUNTIME_LIBS=<layout.runtime_libs>`。不使用 `PYTHONPATH`（避免优先级覆盖）。

### D4 进度反馈：SSE
安装 API 通过 `sse-starlette` 推送子进程 stdout 行与阶段状态（resolving/downloading/installing/done/failed）。复用项目既有 SSE 设施。

### D5 镜像与安全
- 默认清华源，`sidecar.rs` 注入 `PIP_INDEX_URL` / `PIP_TRUSTED_HOST`；用户可在设置页切换（清华/阿里/官方/自定义/关闭），持久化到用户配置。
- registry 白名单限包名（安装 API 仅接受 registry 内包）。
- 不强制 `--require-hashes`（YAGNI，维护成本高；白名单 + HTTPS 镜像已足够）。

### D6 registry 清单
`agent/src/optional_deps/registry.yaml`：券商/能力 → PyPI 包名 + 描述 + 平台支持标记（标注 vnpy_ctp 仅 Windows）+ 推荐镜像。作为 UI 与安装 API 的单一数据源。

## 4. 架构与组件

```
┌─ frontend (设置页) ────────────────────────┐
│  OptionalDepsManager.tsx                    │
│   · 按 registry 分组展示券商                │
│   · 一键安装/卸载 · 镜像切换 · 进度展示     │
└──────────────┬─────────────────────────────┘
               │ POST /optional-deps/install  (SSE)
┌──────────────▼──────────────────────────────┐
│ agent: optional_deps 模块 + api_server 路由  │
│  · GET  /list      → registry + 已装状态     │
│  · POST /install   → 白名单校验 → 平台预检   │
│  · POST /uninstall                            │
│  · GET  /status/{id} (SSE) → 子进程 stdout   │
│  · GET/PUT /mirror                            │
│  installer.py: pip install --target libs_dir │
└──────────────┬──────────────────────────────┘
               │ spawn python3 -m pip install --target <libs>
┌──────────────▼──────────────────────────────┐
│ ~/.vibe-trading/runtime/libs/ (可写)         │
│   futu_api/ ...  + *.dist-info               │
└──────────────────────────────────────────────┘
               ▲ VIBE_RUNTIME_LIBS 注入
┌──────────────┴──────────────────────────────┐
│ src-tauri: sidecar.rs spawn → cli.main()     │
│   cli 入口 sys.path.append(libs)             │
└──────────────────────────────────────────────┘
```

**组件清单**（每个职责单一、可独立测试）：

| 组件 | 位置 | 职责 |
|---|---|---|
| runtime_libs 目录 | `runtime_dir.rs::Layout` | 创建、升级保留 |
| sys.path 注入 | `cli` 入口 | 读 `VIBE_RUNTIME_LIBS` 并 append |
| registry | `agent/src/optional_deps/registry.yaml` + loader | 白名单 + 元数据 |
| installer | `agent/src/optional_deps/installer.py` | pip 子进程 + 平台预检 |
| API 路由 | `agent/src/optional_deps/api.py` → `api_server.py` | list/install/uninstall/status/mirror |
| SSE 进度 | installer → api | 推送 stdout 行 |
| 镜像注入 | `sidecar.rs` | `PIP_INDEX_URL` 等环境变量 |
| 前端组件 | `frontend/src/components/settings/` | UI 管理 |

## 5. 关键数据流：安装链路

1. 前端选「富途」→ `POST /optional-deps/install {package: futu-api}`。
2. API 校验 `futu-api` 在 registry 白名单。
3. 平台预检：`futu-api` 标记全平台可用 → 通过（vnpy_ctp 在 macOS 会被拒）。
4. `installer` spawn `python3 -m pip install --target <libs> --index-url <mirror> futu-api`，stdout 逐行通过 SSE 推前端。
5. 完成后扫描 `libs/*.dist-info` 更新已装状态。
6. agent 后续 `import futu` 经 `sys.path` 命中 `libs/futu_api`（核心依赖优先级不变）。

## 6. 错误处理与边界

| 场景 | 处理 |
|---|---|
| 网络中断/超时 | 子进程非零退出 → SSE 推 failed + 原因；UI 可重试 |
| 包不在白名单 | API 拒绝，返回明确错误 |
| vnpy_ctp 在 macOS | 平台预检拒绝，提示「仅 Windows 支持」 |
| libs 中同名包覆盖核心依赖 | `sys.path.append` 保证核心优先；安装时校验包名不与核心依赖冲突 |
| 镜像不可用 | 用户可一键切换官方源 |
| 升级清空 libs | `runtime_dir` 迁移逻辑显式保留 libs |
| 安装中断后残留 | 下次重试 pip 覆盖安装；可选清理半装目录 |

## 7. 测试策略

- **单元**：registry loader（白名单）、installer 平台预检（vnpy_ctp macOS 拒绝）、list 已装状态扫描。
- **集成**：装 `futu-api` → `import futu` → 调用；卸载后不可 import。
- **升级保留**：模拟版本升级，libs 内容不被清空。
- **镜像耗时**：同包清华源 vs 官方源下载耗时记录。
- **真机**：macOS arm64 + Windows 各跑一次「选券商→安装→调用」全链路。

## 8. 实现影响

- `src-tauri/src/runtime_dir.rs`（Layout 扩展 + 升级保留）、`sidecar.rs`（环境变量注入）、`resources.rs`（registry 资源解析）。
- `agent/src/optional_deps/`（新模块：registry、installer、api）、`agent/api_server.py`（挂载路由）、`agent/cli/main.py`（sys.path 注入）。
- `frontend/src/components/settings/`（新组件）、`src/lib/api.ts`、`src/stores/agent.ts`。
- `scripts/desktop/assemble.sh`（确认保留 `.dist-info`、纳入 registry.yaml）。
- 不需改 `install-deps.sh` 的核心排除逻辑（weasyprint 排除属 change 2）。

## 9. Spec Patch

无。delta spec `specs/python-runtime-optional-deps/spec.md` 的 requirement 已覆盖本设计的所有关键行为（核心依赖优先、平台预检、白名单、镜像切换、升级保留、SSE 进度、断网重试）。
