# Agent 核心模块

## 概述

Agent 核心是 Vibe Trading 的智能决策引擎，基于 LangGraph ReAct 模式实现。它接收用户消息，调用 LLM 生成推理和工具调用，执行工具并循环迭代，直到完成任务。

**源文件**: `agent/src/agent/` 目录下的多个文件

## 核心组件

### 1. AgentLoop — 主循环

`AgentLoop` 类定义在 `agent/src/agent/loop.py` L427-L1467，是整个 Agent 的执行中枢。主要方法：

- **`run(user_message, history, session_id)`** (L476-L925)：一次完整的 Agent 运行，包含：
  - 构建上下文提示词（ContextBuilder）
  - 调用 LLM（ChatLLM）
  - 解析工具调用（ToolRegistry）
  - 执行工具并处理结果
  - 自动上下文压缩（_auto_compact）
  - 发射进度事件（ProgressEvent）
  
- **`_process_tool_calls()`** (L929-L989)：处理 LLM 返回的工具调用，区分只读工具（并行执行）和写入工具（顺序执行）

- **`_invoke_tool()`** (L1133-L1286)：单个工具执行，含超时控制、心跳检测、进度发射

**使用场景**:
```python
from src.agent.loop import AgentLoop
from src.agent.tools import ToolRegistry

registry = ToolRegistry()
loop = AgentLoop(llm=my_llm, registry=registry)
result = loop.run("分析 AAPL 的技术指标")
```

### 2. ToolRegistry — 工具注册与调度

`ToolRegistry` 类定义在 `agent/src/agent/tools.py` L54-L91，管理所有可用工具：

- **`register(tool)`** (L60-L62)：注册一个 BaseTool 子类
- **`get(name)`** (L64-L66)：根据名称查找工具
- **`execute(name, params)`** (L72-L84)：执行工具，返回 JSON 结果
- **`get_definitions()`** (L68-L70)：生成 OpenAI 函数调用格式的 Schema 列表

`BaseTool` 抽象基类（`agent/src/agent/tools.py` L13-L51）定义了工具接口：
- `name`：唯一标识符
- `description`：LLM 可见的描述
- `parameters`：JSON Schema 格式的参数定义
- `execute()`：执行方法（抽象方法，子类实现）
- `check_available()`：检查依赖是否满足（返回 False 则跳过注册）

### 3. 工具注册表构建

`build_registry()` 定义在 `agent/src/tools/__init__.py` L66-L245，通过 `_discover_subclasses()` 自动发现所有 `BaseTool` 子类：

- 设置了 70+ 金融分析工具
- 按类别注册：市场数据、回测、因子分析、实盘交易、Swarm、影子账户等
- 支持 MCP 工具包装器（`mcp.py`）
- 可选 Shell 工具（根据环境变量控制）

**使用场景**:
```python
from src.tools import build_registry
registry = build_registry(agent_config=my_config)
```

### 4. 辅助组件

| 组件 | 文件 | 行号 | 职责 |
|------|------|------|------|
| `ContextBuilder` | `agent/src/agent/context.py` | 全局 | 构建 Agent 系统提示词，含技能描述、工具定义、对话历史 |
| `WorkspaceMemory` | `agent/src/agent/memory.py` | 全局 | 工作区记忆管理，持久化关键信息 |
| `HeartbeatTimer` | `agent/src/agent/progress.py` | 全局 | 工具执行心跳检测，超时中断 |
| `ProgressEvent` | `agent/src/agent/progress.py` | 全局 | 进度事件数据结构 |
| `TraceWriter` | `agent/src/agent/trace.py` | 全局 | 运行追踪记录器 |
| `RunStateStore` | `agent/src/core/state.py` | 全局 | 运行状态持久化 |

### 5. 技能加载

`SkillsLoader` 定义在 `agent/src/agent/skills.py`，负责从 `agent/src/skills/` 目录加载领域技能 SKILL.md 文件。每个技能是一个独立的领域专家提示词包，涵盖技术分析、基本面、加密货币、期权策略等 70+ 领域。

**使用场景**:
```python
from src.agent.skills import SkillsLoader
loader = SkillsLoader()
skills = loader.load(["technical-basic", "candlestick"])
```