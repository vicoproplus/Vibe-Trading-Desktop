# API 服务模块

## 概述

API 服务是 Vibe Trading 的后端入口，基于 FastAPI 框架构建，提供 RESTful API 和 SSE 流式推送。支持两种启动入口：CLI 命令行 `vibe-trading serve` 和 MCP 服务器 `vibe-trading-mcp`。

**源文件**: `agent/api_server.py` (3626 行, 225 个符号)

## 核心功能

### 1. 服务启动

`serve_main()` 函数是 API 服务器的 CLI 入口（`agent/api_server.py` L3563-L3622），通过 argparse 解析 `--port`（默认 8000）和 `--host`（默认 0.0.0.0）参数，使用 uvicorn 运行 FastAPI 应用。dev 模式下同时启动 Vite 开发服务器监听 :5173；prod 模式下挂载 `frontend/dist/` 静态文件作为 SPA 前端。

**使用场景**: 
```bash
vibe-trading serve --port 8899       # 生产模式
vibe-trading serve --port 8899 --dev  # 开发模式含前端热重载
```

### 2. API 路由

#### 健康检查
- **`GET /health`** (`agent/api_server.py` L1711-L1718)：返回服务状态 `{"status": "healthy", "service": "Vibe-Trading API"}`，Sidecar 启动后通过此端点轮询确认服务就绪

#### 会话管理
- **`POST /sessions`** (`agent/api_server.py` L1872-L1886)：创建新会话
- **`GET /sessions`** (`agent/api_server.py` L1889-L1906)：列举会话（limit 参数，默认 50，最大 200）
- **`GET /sessions/{session_id}`** (`agent/api_server.py` L1909-L1926)：获取指定会话详情
- **`DELETE /sessions/{session_id}`** (`agent/api_server.py` L2128-L2139)：删除会话
- **`PATCH /sessions/{session_id}`** (`agent/api_server.py` L2147-L2162)：更新会话属性

#### 消息交互
- **`POST /sessions/{session_id}/messages`** (`agent/api_server.py` L2165-L2180)：发送消息给 Agent
- **`GET /sessions/{session_id}/messages`** (`agent/api_server.py` L2196-L2215)：获取历史消息（limit 默认 100，最大 1000）
- **`POST /sessions/{session_id}/cancel`** (`agent/api_server.py` L2183-L2193)：取消当前处理
- **`GET /sessions/{session_id}/events`** (`agent/api_server.py` L2218-L2267)：SSE 流式事件订阅（思考过程、工具调用状态、结果）

#### 回测与运行
- **`GET /runs`** (`agent/api_server.py` L1502-L1600)：列举运行记录（limit 默认 20）
- **`GET /runs/{run_id}`** (`agent/api_server.py` L1485-L1499)：获取单次运行详情及分析
- **`GET /runs/{run_id}/code`** (`agent/api_server.py` L1443-L1462)：获取回测生成的策略代码
- **`GET /runs/{run_id}/pine`** (`agent/api_server.py` L1465-L1482)：获取 Pine Script 代码

#### LLM 设置
- **`GET /settings/llm`** (`agent/api_server.py` L1603-L1610)：获取当前 LLM 配置
- **`PUT /settings/llm`** (`agent/api_server.py` L1613-L1669)：更新 LLM 配置（API Key、模型、参数）

#### 数据源设置
- **`GET /settings/data-sources`** (`agent/api_server.py` L1672-L1679)：获取数据源配置
- **`PUT /settings/data-sources`** (`agent/api_server.py` L1682-L1708)：更新数据源配置

#### 目标管理
- **`POST /sessions/{session_id}/goal`** (`agent/api_server.py` L1929-L1971)：创建研究目标
- **`GET /sessions/{session_id}/goal`** (`agent/api_server.py` L1974-L1986)：获取目标
- **`PATCH /sessions/{session_id}/goal`** (`agent/api_server.py` L1989-L2021)：更新目标
- **`POST /sessions/{session_id}/goal/evidence`** (`agent/api_server.py` L2024-L2079)：添加证据
- **`PATCH /sessions/{session_id}/goal/status`** (`agent/api_server.py` L2082-L2125)：更新目标状态

#### 实盘交易
- **`POST /mandate/commit`** (`agent/api_server.py` L2808-L2853)：提交交易委托书
- **`POST /live/halt`** (`agent/api_server.py` L2856-L2878)：触发紧急暂停
- **`POST /live/resume`** (`agent/api_server.py` L2881-L2902)：恢复实盘
- **`GET /live/status`** (`agent/api_server.py` L3013-L3051)：查询实盘状态
- **`POST /live/authorize`** (`agent/api_server.py` L3054-L3086)：授权券商连接
- **`POST /live/runner/start`** (`agent/api_server.py` L3259-L3311)：启动实盘运行器
- **`POST /live/runner/stop`** (`agent/api_server.py` L3314-L3343)：停止实盘运行器

#### Swarm 多智能体
- **`GET /swarm/presets`** (`agent/api_server.py` L2401-L2405)：列举预设团队
- **`POST /swarm/runs`** (`agent/api_server.py` L2408-L2424)：创建 Swarm 运行
- **`GET /swarm/runs`** (`agent/api_server.py` L2427-L2449)：列举 Swarm 运行
- **`GET /swarm/runs/{run_id}`** (`agent/api_server.py` L2452-L2474)：获取运行状态
- **`GET /swarm/runs/{run_id}/events`** (`agent/api_server.py` L2477-L2505)：SSE 事件流
- **`POST /swarm/runs/{run_id}/cancel`** (`agent/api_server.py` L2508-L2516)：取消运行
- **`POST /swarm/runs/{run_id}/retry`** (`agent/api_server.py` L2519-L2549)：重试运行

#### 影子账户
- **`GET /shadow-reports/{shadow_id}`** (`agent/api_server.py` L2294-L2316)：获取影子账户报告（HTML 或 PDF）

#### 文件上传
- **`POST /upload`** (`agent/api_server.py` L2319-L2374)：上传文件（策略代码、交易日志等）

#### 其他
- **`GET /skills`** (`agent/api_server.py` L1787-L1799)：列举可用技能
- **`GET /api`** (`agent/api_server.py` L1802-L1810)：API 信息
- **`GET /correlation`** (`agent/api_server.py` L1731-L1758)：计算相关系数矩阵
- **`POST /system/shutdown`** (`agent/api_server.py` L1767-L1784)：关闭服务

### 3. 认证与安全

API 认证通过 `require_auth` 依赖项实现（`agent/api_server.py` L677-L691），支持两种模式：

- **API Key 认证**：通过 `Authorization: Bearer <key>` 头或 `?auth_key=` 查询参数传递，与 `API_AUTH_KEY` 环境变量比对（`agent/api_server.py` L813-L841）
- **本地回环免认证**：来自 `127.0.0.1` / `::1` 的请求自动跳过认证（`agent/api_server.py` L844-L855）
- **跨站请求防护**：检查 Origin 头，拒绝来自浏览器跨站的非授权请求（`agent/api_server.py` L767-L781）
- **中间件**：含回环地址过滤中间件（L564-L572）、遥测错误中间件（L576-L589）、SPA 深层链接回退中间件（L629-L644）

### 4. 数据模型

FastAPI 路由使用的 Pydantic 模型（`agent/api_server.py` L64-L460）：

| 模型 | 用途 | 定义位置 |
|------|------|----------|
| `Artifact` | 回测产物（代码/Pine Script） | L64-L70 |
| `BacktestMetrics` | 回测指标 | L73-L83 |
| `RunInfo` | 运行记录摘要 | L94-L104 |
| `RunResponse` | 完整运行详情 | L107-L140 |
| `HealthResponse` | 健康检查响应 | L143-L147 |
| `LLMSettingsResponse` | LLM 配置 | L164-L180 |
| `LiveStatusResponse` | 实盘状态 | L456-L460 |
| `CommitMandateRequest` | 委托书提交 | L351-L366 |
| `ActiveMandateState` | 活跃委托状态 | L424-L435 |

### 5. MCP 服务器

`agent/mcp_server.py` 提供 MCP (Model Context Protocol) 接口，通过 `FastMCP` 框架注册了 50+ 工具函数，包括：市场数据获取、回测执行、因子分析、交易连接、Swarm 控制、影子账户管理等。

**使用场景**:
```bash
vibe-trading-mcp                          # 启动 MCP 服务器
vibe-trading-mcp --help                   # 查看帮助
```

### 6. CLI 命令行

`agent/cli/main.py` 提供交互式终端界面，基于 Typer + Rich 构建：

| 命令 | 用途 | 定义位置 |
|------|------|----------|
| `chat` | 交互式 ReAct 聊天循环 | L1336-L1340 |
| `serve` | 启动 FastAPI 服务 | L1342-L1351 |
| `list` | 列举运行记录 | L1353-L1355 |
| `show` | 展示运行详情 | L1357-L1359 |
| `init` | 运行设置向导 | L1361-L1363 |

**使用场景**:
```bash
vibe-trading chat                          # 启动交互式聊天
vibe-trading serve                         # 启动 API 服务
```

## 使用示例

```python
# 启动 API 服务器
from agent.api_server import serve_main
serve_main(["--port", "8899"])
```

```python
# 通过 HTTP 调用 API
import httpx
r = httpx.get("http://127.0.0.1:8899/health")
print(r.json())  # {"status": "healthy", "service": "Vibe-Trading API", ...}
```