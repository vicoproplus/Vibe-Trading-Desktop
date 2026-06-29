# Vibe Trading Desktop — 知识库索引

> 本索引针对 Vibe Trading Desktop 项目提供文档导航，涵盖项目概述、项目规范和文档目录三大部分。
>
> 生成时间: 2026-06-29 | Git Commit: 5a10417

---

# 第一部分: 项目概述

## 1. 项目介绍

Vibe Trading Desktop 是一个**自然语言驱动的金融研究 AI Agent**，集成回测引擎，封装在 Tauri v2 桌面壳中，支持 macOS/Windows 分发。由 HKUDS（HKU Data Science）开发。

**项目定位**：用户通过自然语言与 AI Agent 交互，完成金融数据分析、策略回测、Alpha 因子研究、实盘交易等任务。支持从单句指令到多 Agent 协作研究的全链路金融研究工作流。

**源文件**: `pyproject.toml`, `src-tauri/Cargo.toml`, `frontend/package.json`

## 2. 三层架构

项目采用经典的**三层架构**，每层独立构建、分工明确：

| 层次 | 技术栈 | 目录 | 职责 |
|------|--------|------|------|
| Python 后端 | FastAPI + LangGraph + 70+ 金融技能 | `agent/` | API 服务、Agent 推理、回测引擎、实盘交易 |
| React 前端 | Vite + React 19 + TypeScript + ECharts | `frontend/` | SPA 用户界面、状态管理、图表可视化 |
| Tauri 桌面壳 | Rust + Tauri v2 | `src-tauri/` | 原生窗口、Python 侧车管理、资源打包 |

**源文件**: `agent/api_server.py` (L3563-L3622), `frontend/vite.config.ts`, `src-tauri/tauri.conf.json`

## 3. 服务定位

| 模式 | 启动方式 | 端口 | 适用场景 |
|------|----------|------|----------|
| API 服务器 | `vibe-trading serve` | 8899 | 后端服务 + 前端 SPA |
| CLI 交互 | `vibe-trading chat` | — | 终端内的 ReAct 聊天 |
| MCP 服务器 | `vibe-trading-mcp` | — | MCP 协议集成 |
| Docker | `docker compose up` | 8899 | 容器化部署 |
| 桌面应用 | Tauri 启动 | 随机 | 原生桌面体验 |

**源文件**: `agent/cli/main.py` (L1234-L1281), `agent/mcp_server.py` (L1892-L1908), `agent/api_server.py` (L1711-L1718)

## 4. 对外接口

### REST API (FastAPI)
- 基础地址: `http://127.0.0.1:<port>`
- 认证方式: `API_AUTH_KEY` Bearer Token 或本地回环免认证
- 数据格式: JSON
- 流式推送: Server-Sent Events (SSE)

**关键端点**:

| 端点 | 方法 | 说明 | 行号 |
|------|------|------|------|
| `/health` | GET | 健康检查 | `agent/api_server.py:1711` |
| `/sessions/{id}/events` | GET | SSE 事件流 | `agent/api_server.py:2218` |
| `/sessions/{id}/messages` | POST | 发送消息 | `agent/api_server.py:2165` |
| `/live/status` | GET | 实盘状态 | `agent/api_server.py:3013` |
| `/swarm/runs` | POST | 创建 Swarm 运行 | `agent/api_server.py:2408` |
| `/mandate/commit` | POST | 提交委托书 | `agent/api_server.py:2808` |

### MCP 协议
MCP 服务器通过 `FastMCP` 框架注册了 50+ 工具函数，支持标准 MCP 客户端集成。

**源文件**: `agent/mcp_server.py` — 包含 `list_skills`, `backtest`, `get_market_data`, `run_swarm` 等 50+ 工具

### CLI 命令行

| 命令 | 说明 | 定义位置 |
|------|------|----------|
| `vibe-trading chat` | 交互式 ReAct 聊天 | `agent/cli/main.py:1336` |
| `vibe-trading serve` | 启动 FastAPI 服务 | `agent/cli/main.py:1342` |
| `vibe-trading-mcp` | MCP 服务器 | `agent/mcp_server.py:1892` |

## 5. 数据模型

### 核心 Pydantic 模型

| 模型 | 文件 | 行号 | 用途 |
|------|------|------|------|
| `BacktestConfigSchema` | `agent/backtest/runner.py` | L54-L143 | 回测配置验证 |
| `Artifact` | `agent/api_server.py` | L64-L70 | 回测产物 |
| `RunResponse` | `agent/api_server.py` | L107-L140 | 运行详情 |
| `HealthResponse` | `agent/api_server.py` | L143-L147 | 健康检查 |
| `CommitMandateRequest` | `agent/api_server.py` | L351-L366 | 委托书提交 |
| `ActiveMandateState` | `agent/api_server.py` | L424-L435 | 活跃委托状态 |
| `LiveStatusResponse` | `agent/api_server.py` | L456-L460 | 实盘状态 |
| `SwarmRun` | `agent/src/swarm/models.py` | 全局 | Swarm 运行实例 |
| `ShadowRun` | `agent/src/shadow_account/models.py` | 全局 | 影子运行记录 |
| `BaseTool` | `agent/src/agent/tools.py` | L13-L51 | 工具基类 |

## 6. 业务模块

### 后端核心模块 (agent/)

| 模块 | 目录 | 文件数 | 说明 | 文档 |
|------|------|--------|------|------|
| Agent 核心 | `agent/src/agent/` | 9 | LangGraph ReAct 主循环、工具注册、技能加载 | [wiki/01-业务模块-Agent核心.md](wiki/01-业务模块-Agent核心.md) |
| API 服务 | `agent/api_server.py` | 1 | FastAPI REST + SSE | [wiki/01-业务模块-API服务.md](wiki/01-业务模块-API服务.md) |
| 回测引擎 | `agent/backtest/` | ~30 | 多市场回测、指标、优化器 | [wiki/01-业务模块-回测引擎.md](wiki/01-业务模块-回测引擎.md) |
| 数据加载器 | `agent/backtest/loaders/` | ~30 | 30+ 数据源适配器 | [wiki/01-业务模块-数据加载器.md](wiki/01-业务模块-数据加载器.md) |
| 实盘交易 | `agent/src/live/` | ~15 | 安全交易、门控、授权 | [wiki/01-业务模块-实盘交易.md](wiki/01-业务模块-实盘交易.md) |
| 交易连接器 | `agent/src/trading/` | ~10 券商 | 10+ 券商 SDK 封装 | [wiki/01-业务模块-交易连接器.md](wiki/01-业务模块-交易连接器.md) |
| 因子与 Alpha | `agent/src/factors/` | ~400 因子 | 因子计算、基准、对比 | [wiki/01-业务模块-因子与Alpha.md](wiki/01-业务模块-因子与Alpha.md) |
| Swarm 多智能体 | `agent/src/swarm/` | ~15 | 多 Agent 协作编排 | [wiki/01-业务模块-Swarm多智能体.md](wiki/01-业务模块-Swarm多智能体.md) |
| 影子账户 | `agent/src/shadow_account/` | ~10 | 纸面交易模拟 | [wiki/01-业务模块-影子账户.md](wiki/01-业务模块-影子账户.md) |

### 前端模块 (frontend/src/)

| 模块 | 目录 | 说明 | 文档 |
|------|------|------|------|
| 页面 | `frontend/src/pages/` | SPA 路由页面 | [wiki/01-业务模块-前端页面.md](wiki/01-业务模块-前端页面.md) |
| 状态与 API | `frontend/src/stores/` + `lib/` | Zustand Store、API 客户端、SSE | [wiki/01-业务模块-前端状态与API.md](wiki/01-业务模块-前端状态与API.md) |
| 组件库 | `frontend/src/components/` | 聊天、图表、布局、通用组件 | [wiki/01-业务模块-前端组件库.md](wiki/01-业务模块-前端组件库.md) |

### 桌面壳模块 (src-tauri/)

| 模块 | 文件 | 说明 | 文档 |
|------|------|------|------|
| Tauri 桌面壳 | `src-tauri/src/` | Rust 侧车、资源管理、端口 | [wiki/01-业务模块-Tauri桌面壳.md](wiki/01-业务模块-Tauri桌面壳.md) |

## 7. 适配器层

### 数据源适配器 (30+)
`agent/backtest/loaders/` 目录下的 30+ 数据加载器，覆盖全球股票、A 股、加密货币、期货、外汇、宏观经济等。通过 `registry.py` 注册中心统一管理。

**关键文件**: `agent/backtest/loaders/registry.py`

### 券商连接器 (10+)
`agent/src/trading/connectors/` 目录下的 10+ 券商 SDK 封装，统一交易接口。

**关键文件**: `agent/src/trading/service.py` — 连接器查找

### LLM 提供者 (13+)
`agent/src/providers/` 目录支持 13+ LLM 提供者配置（OpenRouter、OpenAI、DeepSeek、Gemini、Groq、DashScope、Zhipu、Moonshot、MiniMax、Xiaomi MIMO、Z.ai、Ollama 等）。

**关键文件**: `agent/src/providers/llm.py`, `agent/.env.example`

## 8. 中间件

| 中间件 | 文件 | 行号 | 职责 |
|--------|------|------|------|
| 回环地址过滤 | `agent/api_server.py` | L564-L572 | 拒绝非本地回环请求 |
| 遥测错误 | `agent/api_server.py` | L576-L589 | 遥测错误收集 |
| SPA 深层链接回退 | `agent/api_server.py` | L629-L644 | SPA 路由回退 |
| CORS | `agent/api_server.py` | L31 | 跨域配置 |
| 认证依赖 | `agent/api_server.py` | L677-L691 | API Key / 本地免认证 |

---

# 第二部分: 项目规范

## 1. 编码规范

### Python 后端

| 规范项 | 设定 | 来源 |
|--------|------|------|
| 行宽 | 120 字符 | `pyproject.toml:133` |
| 目标版本 | Python 3.11+ | `pyproject.toml:132` |
| 缩进 | 4 空格 | Python 标准 |
| 换行 | LF | `agent/.editorconfig:5` |
| 文件编码 | UTF-8 | `agent/.editorconfig:4` |
| 末尾空行 | 始终保留 | `agent/.editorconfig:6` |
| 尾随空格 | 删除 | `agent/.editorconfig:7` |
| 类型注解 | 使用 `from __future__ import annotations` | 项目所有模块统一使用 |

**Lint 配置** (`pyproject.toml:154-156`):
```
select = ["E", "F", "W"]
ignore = ["E501"]  # 行宽由 LineLength 管控
```

**特殊规则**:
- 因子库文件 (`agent/src/factors/zoo/**/*.py`) 忽略 F401（未用导入）——因子代码需保持与研究论文公式一致 (`pyproject.toml:162`)
- `noqa` 注释用于局部压制，如 `# noqa: PLC0415` 用于延迟导入场景
- `type: ignore` 用于处理跨模块类型不匹配的边界情况

### TypeScript 前端

| 规范项 | 设定 | 来源 |
|--------|------|------|
| 严格模式 | `strict: true` | `frontend/tsconfig.json:14` |
| 未用局部变量 | `noUnusedLocals: true` | `frontend/tsconfig.json:15` |
| 未用参数 | `noUnusedParameters: true` | `frontend/tsconfig.json:16` |
| 模块系统 | ESNext + bundler resolution | `frontend/tsconfig.json:7-8` |
| JSX | `react-jsx` | `frontend/tsconfig.json:13` |
| 路径别名 | `@/*` → `./src/*` | `frontend/tsconfig.json:20` |
| 类型检查 | `tsc -b` 作为构建前步骤 | `frontend/package.json` scripts |
| 测试 | Vitest（jsdom 环境，globals enabled） | `frontend/vitest.config.ts` |

### Rust 桌面壳

| 规范项 | 设定 |
|--------|------|
| 代码风格 | Cargo 默认 rustfmt |
| 异步 | tokio 运行时 |
| 测试框架 | cargo test, 每个模块有对应单元测试 |
| 错误处理 | Rust Result/Option 模式 |

**源文件**: `src-tauri/Cargo.toml`, `src-tauri/tests/sidecar_tests.rs`

## 2. 代码结构规范

### 目录组织

```
agent/                        # Python 后端
  ├── api_server.py           # FastAPI 服务入口（单体文件）
  ├── mcp_server.py           # MCP 协议服务器（单体文件）
  ├── cli/                    # CLI 命令行界面
  ├── backtest/               # 回测引擎
  │   ├── engines/            # 各市场引擎实现
  │   ├── loaders/            # 数据加载器
  │   ├── optimizers/         # 组合优化器
  │   └── metrics.py          # 绩效指标
  ├── src/                    # 核心业务逻辑
  │   ├── agent/              # Agent 核心（loop/context/tools/skills）
  │   ├── live/               # 实盘交易
  │   ├── trading/            # 交易连接器
  │   ├── swarm/              # 多智能体
  │   ├── factors/            # 因子库
  │   ├── shadow_account/     # 影子账户
  │   ├── config/             # 配置管理
  │   ├── providers/          # LLM 提供者
  │   ├── session/            # 会话管理
  │   ├── goal/               # 研究目标
  │   └── tools/              # Agent 工具
  └── tests/                  # 测试（与 src/ 结构对应）

frontend/                     # React 前端
  ├── src/
  │   ├── pages/              # 页面组件（懒加载）
  │   ├── components/         # 可复用组件
  │   │   ├── chat/           # 聊天相关
  │   │   ├── charts/         # 图表
  │   │   ├── layout/         # 布局
  │   │   ├── auth/           # 认证
  │   │   └── common/         # 通用
  │   ├── stores/              # Zustand 状态管理
  │   ├── hooks/               # React Hooks
  │   ├── lib/                 # 工具库 / API 客户端
  │   ├── types/               # TypeScript 类型定义
  │   └── i18n/                # 国际化
  └── openspec/                # 特性规范文档

src-tauri/                    # Tauri 桌面壳 (Rust)
  └── src/                    # Rust 源码
```

## 3. 注释风格

### Python

项目代码使用以下注释约定：

- **模块级 docstring**：每个 `.py` 文件开头使用 `"""Module description."""`
- **函数 docstring**：包含简短描述，必要参数文档
- **行内注释**：解释复杂逻辑的理由（"why" 而非 "what"）
- **未完成标记**：使用标准标记注明未完工作（如 `// 待实现`、`# 待优化`）
- **类型注解**：函数参数和返回值使用类型注解
- **延迟导入**：使用局部 import 避免循环依赖，标注 `# noqa: PLC0415`

示例（`agent/src/agent/trace.py:1-5`）:
```python
"""TraceWriter: crash-safe JSONL trace writer.

One JSON record per line; append + flush keeps the trace useful after crashes.
"""
```

### TypeScript

- 使用 JSDoc 风格的注释标注复杂逻辑
- 组件 Props 类型显示声明
- `__tests__/` 目录中的测试文件与被测文件相邻存放

## 4. 错误处理

### 后端错误模式

| 层级 | 错误处理策略 | 示例 |
|------|-------------|------|
| API 层 | FastAPI HTTPException（含状态码） | `agent/api_server.py` 各端点 |
| Agent 核心 | 工具返回 `{"status": "error", ...}` | `agent/src/agent/tools.py:75-84` |
| 回测引擎 | 异常冒泡至 Runner 统一处理 | `agent/backtest/runner.py` |
| 实盘交易 | fail-closed（拒绝代替允许） | `agent/src/live/sdk_order_gate.py` |
| 工具执行 | 超时中断 + 心跳检测 | `agent/src/agent/loop.py:1133-1286` |
| 安全校验 | AST 静态分析提前拒绝 | `agent/backtest/runner.py:202-291` |

**遥测**：非预期的 HTTP 异常通过 `telemetry/counters.record_error()` 收集（`agent/api_server.py:577-589`）。

### 前端错误模式

- 组件级 `ErrorBoundary` 捕获 React 渲染错误（`frontend/src/components/common/ErrorBoundary.tsx`）
- SSE 断线自动重连（`frontend/src/hooks/useSSE.ts`）
- API 失败通过 HTTP 状态码判断，前端统一处理

## 5. 测试规范

### 目录结构

测试文件与被测代码分离但结构对应：

```
agent/tests/              # Python 后端测试
  ├── 各模块独立文件       # pytest 风格
  ├── factors/            # 因子测试（含 golden CSV 对照）
  └── fixtures/           # 测试固定数据

frontend/src/
  └── __tests__/          # 端对端测试
    └── (各组件/模块的测试文件)
```

### Python 测试规范
- 框架: pytest
- 位置: `agent/tests/` 目录，文件名 `test_*.py`
- 因子测试使用 golden CSV 文件进行精确数值匹配
- **安全关键测试**: `test_sdk_order_gate.py`, `test_mandate_enforcement.py`, `test_halt.py`

### 前端测试规范
- 框架: Vitest（v8 覆盖率）
- 环境: jsdom
- 位置: `src/**/__tests__/*.test.{ts,tsx}`
- 覆盖范围: `src/lib/**`, `src/stores/**`

## 6. 设计原则

### SOLID 原则应用

| 原则 | 应用 | 示例 |
|------|------|------|
| 单一职责 | 每个模块聚焦一个业务领域 | Agent 核心、回测引擎、实盘交易分离 |
| 开闭原则 | BaseEngine 抽象基类 + 具体引擎实现 | `backtest/engines/base.py` → 8 个引擎子类 |
| 接口隔离 | ToolRegistry + BaseTool 接口 | `agent/src/agent/tools.py` |
| 依赖倒置 | Loader Registry 解耦数据源选择 | `backtest/loaders/registry.py` |

### 安全默认原则

- **fail-closed**: 实盘交易默认拒绝，需显式授权（Mandate）
- **全局熔断**: 单一 Halt 信号覆盖所有券商
- **AST 沙箱**: 信号引擎代码执行前静态分析
- **路径安全**: 文件工具限制访问范围（`agent/src/tools/path_utils.py`）

### 架构原则

- **三层分离**: Python 后端 / React 前端 / Tauri 桌面壳独立运行，通过 HTTP/SSE 通信
- **配置驱动**: 数据源、LLM 提供者、券商连接器均通过配置文件注册
- **技能注入**: 70+ 领域技能以 SKILL.md 形式注入 Agent 提示词，无需硬编码

---

# 第三部分: 索引目录

## 版本信息

| 项目 | 值 |
|------|-----|
| 项目名称 | Vibe Trading Desktop |
| 项目版本 | 0.1.10 |
| 知识库生成时间 | 2026-06-29 11:31 |
| Git Commit | `5a10417` |
| 操作人员 | AtomCode (code) |
| 项目语言 | Python 3.11+ / TypeScript / Rust |
| 许可证 | MIT |

## 文档目录

### 主索引
| 文档 | 路径 | 行数 | 说明 |
|------|------|------|------|
| **知识库主索引** | `wiki.md` | ~420 | 项目概述 + 项目规范 + 索引目录 |

### 业务模块文档 (12 个)
| 编号 | 文档 | 层级 | 行数 | 说明 |
|------|------|------|------|------|
| 01 | [01-业务模块-API服务.md](wiki/01-业务模块-API服务.md) | 后端 | ~150 | FastAPI 路由、SSE 流、认证、CLI |
| 02 | [01-业务模块-Agent核心.md](wiki/01-业务模块-Agent核心.md) | 后端 | ~90 | LangGraph ReAct、工具注册、技能加载 |
| 03 | [01-业务模块-回测引擎.md](wiki/01-业务模块-回测引擎.md) | 后端 | ~130 | 多市场引擎、指标、优化器 |
| 04 | [01-业务模块-数据加载器.md](wiki/01-业务模块-数据加载器.md) | 后端 | ~65 | 30+ 数据源适配器 |
| 05 | [01-业务模块-实盘交易.md](wiki/01-业务模块-实盘交易.md) | 后端 | ~120 | 安全交易、门控、授权、运行时 |
| 06 | [01-业务模块-交易连接器.md](wiki/01-业务模块-交易连接器.md) | 后端 | ~60 | 10+ 券商 SDK 封装 |
| 07 | [01-业务模块-因子与Alpha.md](wiki/01-业务模块-因子与Alpha.md) | 后端 | ~80 | 因子库、基准、对比 |
| 08 | [01-业务模块-Swarm多智能体.md](wiki/01-业务模块-Swarm多智能体.md) | 后端 | ~100 | 多 Agent 编排、预设、信任模型 |
| 09 | [01-业务模块-影子账户.md](wiki/01-业务模块-影子账户.md) | 后端 | ~80 | 纸面交易、报告生成 |
| 10 | [01-业务模块-前端页面.md](wiki/01-业务模块-前端页面.md) | 前端 | ~70 | SPA 路由、页面 |
| 11 | [01-业务模块-前端状态与API.md](wiki/01-业务模块-前端状态与API.md) | 前端 | ~100 | Zustand Store、SSE、API 客户端 |
| 12 | [01-业务模块-前端组件库.md](wiki/01-业务模块-前端组件库.md) | 前端 | ~70 | 聊天、图表、布局、通用组件 |
| 13 | [01-业务模块-Tauri桌面壳.md](wiki/01-业务模块-Tauri桌面壳.md) | 桌面 | ~100 | Rust 侧车、资源管理、端口 |

### 文件关系文档 (4 个)
| 编号 | 文档 | 行数 | 说明 |
|------|------|------|------|
| 01 | [02-文件关系-API请求链路.md](wiki/02-文件关系-API请求链路.md) | ~90 | 前端请求 → API → Agent → Tool → 数据 |
| 02 | [02-文件关系-回测执行链路.md](wiki/02-文件关系-回测执行链路.md) | ~130 | 配置 → 数据 → 引擎 → 指标 → 结果 |
| 03 | [02-文件关系-实盘交易链路.md](wiki/02-文件关系-实盘交易链路.md) | ~126 | 调度 → 授权 → 门控 → 连接器 → 审计 |
| 04 | [02-文件关系-桌面启动链路.md](wiki/02-文件关系-桌面启动链路.md) | ~120 | 主入口 → 资源 → 端口 → 侧车 → Webview |

## 关联关系

```
┌─────────────────────────────────────────────────────┐
│                   前端 (React SPA)                   │
│  pages/  ──▶  stores/agent.ts  ──▶  lib/api.ts     │
│              └─▶  hooks/useSSE.ts                   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP + SSE
                       ▼
┌─────────────────────────────────────────────────────┐
│                 API 服务 (FastAPI)                   │
│  api_server.py: routes / auth / middleware          │
├─────────────────────────────────────────────────────┤
│                Agent 核心 (LangGraph)                │
│  AgentLoop → ToolRegistry → BaseTool.execute()     │
├──────────┬──────────┬──────────┬───────────────────┤
│  回测引擎 │  实盘交易  │  Swarm   │  影子账户          │
│  runner.py│  sdk_order│ runtime  │  codegen/backtest│
│  →engines │  _gate.py │ .py →    │  .py             │
│  →loaders │  →halt.py │ presets/ │  →reporter.py    │
├──────────┴──────────┴──────────┴───────────────────┤
│                数据/交易适配器层                      │
│  30+ 数据源加载器  │  10+ 券商连接器                │
└─────────────────────────────────────────────────────┘
                       │ Tauri Sidecar
                       ▼
┌─────────────────────────────────────────────────────┐
│             Tauri 桌面壳 (Rust)                     │
│  main.rs → sidecar.rs → Python process             │
│              → health-check → webview              │
└─────────────────────────────────────────────────────┘
```

## 使用指南

### 首次阅读建议
1. **先读** [01-业务模块-API服务.md](wiki/01-业务模块-API服务.md) — 了解系统入口和接口
2. **再读** [01-业务模块-Agent核心.md](wiki/01-业务模块-Agent核心.md) — 理解 AI Agent 工作机制
3. **选择阅读** 感兴趣的领域模块（回测/实盘/Swarm/前端等）
4. **参考** 文件关系文档理解关键调用链路

### 快速导航
- 想了解系统架构？→ 本索引"第一部分: 项目概述"
- 想知道编码标准？→ 本索引"第二部分: 项目规范"
- 需要修改回测引擎？→ [01-业务模块-回测引擎.md](wiki/01-业务模块-回测引擎.md) + [02-文件关系-回测执行链路.md](wiki/02-文件关系-回测执行链路.md)
- 需要部署实盘交易？→ [01-业务模块-实盘交易.md](wiki/01-业务模块-实盘交易.md) + [02-文件关系-实盘交易链路.md](wiki/02-文件关系-实盘交易链路.md)
- 需要开发前端？→ 3 个前端模块文档