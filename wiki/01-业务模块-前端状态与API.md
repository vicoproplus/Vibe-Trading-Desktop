# 前端状态与 API 模块

## 概述

前端状态与 API 模块负责前端的全局状态管理、后端 API 通信、SSE 流式数据接收，以及认证管理。

## 核心组件

### 1. 全局状态 — Zustand Store

定义在 `frontend/src/stores/agent.ts`，基于 Zustand 的全局状态管理：

**核心状态**：
- `messages`：聊天消息列表
- `events`：SSE 流事件
- `runs`：运行记录列表
- `sessionId`：当前会话 ID
- `loading`：加载状态
- `swarmStatus`：Swarm 运行状态

**关键 Action**：
- `sendMessage()`：发送消息到后端 Agent
- `cancel()`：取消当前请求
- `loadRuns()`：加载历史运行记录
- `loadRun()`：加载单次运行详情
- `loadSwarmPresets()`：加载 Swarm 预设

状态类型定义在 `frontend/src/types/agent.ts`，含完整的消息、运行、事件等 TypeScript 类型定义。

### 2. API 通信层

定义在 `frontend/src/lib/api.ts`，封装所有后端 HTTP API 调用：

**核心函数**：
```typescript
// 会话管理
createSession(prompt: string): Promise<SessionResponse>
listSessions(): Promise<SessionResponse[]>
getSession(sessionId: string): Promise<SessionResponse>
deleteSession(sessionId: string): Promise<void>

// 消息
sendMessage(sessionId: string, content: string): Promise<void>
getMessages(sessionId: string): Promise<MessageResponse[]>

// 运行
listRuns(limit: number): Promise<RunInfo[]>
getRunResult(runId: string): Promise<RunResponse>

// 设置
getLLMSettings(): Promise<LLMSettingsResponse>
updateLLMSettings(settings: UpdateLLMSettingsRequest): Promise<LLMSettingsResponse>
getDataSourceSettings(): Promise<DataSourceSettingsResponse>

// 实盘
getLiveStatus(broker?: string): Promise<LiveStatusResponse>
getBrokerAuthState(broker: string): Promise<BrokerAuthState>

// Swarm
listSwarmPresets(): Promise<string[]>
createSwarmRun(payload: unknown): Promise<unknown>
```

### 3. SSM 事件流

`useSSE` Hook 定义在 `frontend/src/hooks/useSSE.ts`，用于接收后端 SSE 事件流：

- 自动连接 / 断线重连
- 事件类型解析
- 流式文本块处理
- 工具调用进度更新
- 会话事件订阅（`/sessions/{session_id}/events`）
- Swarm 事件订阅（`/swarm/runs/{run_id}/events`）

### 4. 认证管理

定义在 `frontend/src/stores/auth.ts` 和 `frontend/src/lib/apiAuth.ts` / `frontend/src/lib/apiUser.ts`：

- `AuthStore`：用户认证状态（Zustand store）
- `apiAuth.ts`：认证 API 调用
- `apiUser.ts`：用户管理 API 调用
- `RequireAuth` 组件（`frontend/src/components/auth/RequireAuth.tsx`）：路由守卫

**使用场景**:
```tsx
import { useAgentStore } from '../stores/agent'

function MyComponent() {
  const { messages, sendMessage } = useAgentStore()
  
  return (
    <button onClick={() => sendMessage("分析 AAPL")}>
      发送
    </button>
  )
}
```