# 文件关系 - API 请求链路

## 请求链路概述

用户请求从前端或 CLI 发出，经 API 服务流转至 Agent 核心，再到工具执行和数据获取，最终结果返回给用户。

```
用户 → [前端/CLI] → API 层 → Agent 核心 → 工具层 → 数据/交易层
```

## 详细链路

### 1. 前端请求链路

```
Frontend (React SPA)
  ├── frontend/src/pages/Agent.tsx               # 用户交互页面
  ├── frontend/src/stores/agent.ts               # Zustand 状态管理 (sendMessage action)
  ├── frontend/src/hooks/useSSE.ts               # SSE 事件流连接
  └── frontend/src/lib/api.ts                    # HTTP API 调用
        │
        ▼  HTTP POST /sessions/{id}/messages
```

### 2. API 服务层

```
agent/api_server.py
  ├── send_message()           (L2165-L2180)     # POST /sessions/{id}/messages
  ├── require_auth()           (L677-L691)       # 认证检查
  ├── create_session()         (L1872-L1886)     # POST /sessions
  ├── session_events()         (L2218-L2267)     # GET /sessions/{id}/events (SSE)
  └── serve_main()             (L3563-L3622)     # uvicorn 启动入口
        │
        ▼  AgentLoop.run()
```

### 3. Agent 核心层

```
agent/src/agent/
  ├── loop.py → AgentLoop.run()                 (L476-L925)
  │     ├── ContextBuilder (context.py)          # 系统提示词构建
  │     ├── ChatLLM (providers/chat.py)          # LLM 调用
  │     └── ToolRegistry (tools.py)              # 工具调度
  │
  ├── agent/src/core/
  │     ├── runner.py                            # 运行器
  │     └── state.py → RunStateStore             # 运行状态持久化
  │
  └── agent/src/providers/
        └── chat.py → ChatLLM                    # LLM 流式调用
              │
              ▼  tool_name + params
```

### 4. 工具层

```
agent/src/tools/
  ├── __init__.py → build_registry()            (L66-L245)  # 工具注册
  ├── backtest_tool.py                           # 回测执行工具
  ├── market_data_tool.py                        # 市场数据工具
  ├── web_search_tool.py                         # 网络搜索工具
  ├── web_reader_tool.py                         # 网页读取工具
  ├── factor_analysis_tool.py                    # 因子分析工具
  ├── swarm_tool.py                              # Swarm 运行工具
  ├── shadow_account_tool.py                     # 影子账户工具
  ├── goal_tool.py                               # 目标管理工具
  └── ... (60+ 工具)
        │
        ▼  API / SDK 调用
```

### 5. 数据/交易层

```
agent/backtest/loaders/        # 数据加载器 (30+ 数据源)
agent/src/trading/             # 交易连接器 (10+ 券商)
agent/src/live/                # 实盘交易系统
```

### 核心调用链关系

| 步骤 | 调用方 | 被调用方 | 关键文件 |
|------|--------|----------|----------|
| 发送消息 | Agent.tsx → api.ts → api_server.py | `send_message()` | `api_server.py:2165` |
| 创建会话 | api.py → api_server.py | `create_session()` + `SessionService` | `api_server.py:1872` |
| Agent 执行 | API → AgentLoop | `AgentLoop.run()` | `agent/src/agent/loop.py:476` |
| 工具调用 | AgentLoop → ToolRegistry | `ToolRegistry.execute()` | `agent/src/agent/tools.py:72` |
| 流式推送 | API → SSE | `session_events()` | `api_server.py:2218` |
| 认证检查 | API Middleware | `require_auth()` | `api_server.py:677` |