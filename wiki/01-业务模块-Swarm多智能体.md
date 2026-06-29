# Swarm 多智能体模块

## 概述

Swarm 模块实现多 Agent 协作编排，支持将多个 LLM Agent 组织为"研究团队"，每个 Agent 承担不同角色（如技术分析师、基本面分析师、风控经理），协同完成投资研究任务。

**源文件**: `agent/src/swarm/` 目录

## 核心架构

### 1. SwarmRuntime — 运行引擎

`SwarmRuntime` 定义在 `agent/src/swarm/runtime.py` L48-L747，是多智能体运行的核心引擎。

**核心方法**：
- `start_run(config)` (L85-L146)：启动 Swarm 运行
- `cancel_run(run_id)` (L148-L162)：取消运行
- `_execute_run(run)` (L209-L390)：执行运行主流程
- `_execute_layer(run, layer)` (L462-L631)：执行单个层（DAG 层的并行执行）
- `_run_worker_with_retries()` (L633-L727) ：带重试的工作者执行

**执行模型**：
1. 按 DAG 图分层执行
2. 每层内任务并行执行
3. 层间同步（前一层全部完成后进入下一层）
4. 支持重试和超时

### 2. 工作节点

`run_worker()` 在 `agent/src/swarm/worker.py`，是每个 Agent 工作者的执行函数：

- 加载对应角色提示词
- 调用 LLM 生成分析和决策
- 使用限定工具集（按角色配置）
- 输出结构化的任务报告

### 3. 预设团队

定义在 `agent/src/swarm/presets/` 目录下，以 YAML 格式组织的 30+ 预设团队：

| 预设 | 文件 | 团队组成 |
|------|------|----------|
| 投资委员会 | `investment_committee.yaml` | CIO、策略师、风控经理 |
| 权益研究 | `equity_research_team.yaml` | 基本面分析师、技术分析师、估值分析师 |
| 量化策略 | `quant_strategy_desk.yaml` | 因子研究员、回测工程师、风控 |
| 加密货币 | `crypto_research_lab.yaml` | 链上分析师、技术分析师、宏观分析师 |
| 衍生品策略 | `derivatives_strategy_desk.yaml` | 期权策略师、波动率分析师 |
| 宏观策略 | `macro_strategy_forum.yaml` | 宏观经济学家、利率分析师、外汇分析师 |
| 事件驱动 | `event_driven_task_force.yaml` | 事件分析师、并购分析师 |
| 基本面研究 | `fundamental_research_team.yaml` | 财务分析师、行业研究员 |
| 技术分析 | `technical_analysis_panel.yaml` | 形态识别师、指标分析师 |
| ETF 配置 | `etf_allocation_desk.yaml` | 资产配置师、ETF 研究员 |
| 风险委员会 | `risk_committee.yaml` | 风控经理、合规官 |
| 因子研究 | `factor_research_committee.yaml` | 因子研究员、回测工程师 |
| …… | 共 30+ 个预设 | |

### 4. 数据模型

`agent/src/swarm/models.py` 定义了 Swarm 运行的完整数据模型：

- `SwarmRun`：运行实例
- `SwarmTask`：单个任务
- `RunStatus`：运行状态（pending/running/completed/failed/cancelled）
- `SwarmConfig`：配置定义
- `SwarmEvent`：运行时事件

### 5. 附属组件

| 组件 | 文件 | 职责 |
|------|------|------|
| `SwarmStore` | `agent/src/swarm/store.py` | 运行状态持久化 |
| `TaskStore` | `agent/src/swarm/task_store.py` | 任务状态管理 |
| `Grounding` | `agent/src/swarm/grounding.py` | 背景信息预获取 |
| `Serialization` | `agent/src/swarm/serialization.py` | 序列化/反序列化 |
| `TokenTracker` | `agent/src/swarm/models.py` | Token 消耗追踪 |
| `TrustModel` | `agent/src/swarm/models.py` | 信任模型（任务委托权限） |

**使用场景**:
```bash
vibe-trading swarm list-presets                     # 列出所有预设
vibe-trading swarm run investment_committee          # 启动投资委员会
vibe-trading swarm run crypto_research_lab "分析 BTC"  # 带自定义提示
```

```python
from src.swarm.runtime import SwarmRuntime
from src.swarm.store import SwarmStore
from src.swarm.presets import list_presets

presets = list_presets()  # 获取所有预设
runtime = SwarmRuntime(store=SwarmStore(), agent_config=config)
result = runtime.start_run({
    "preset": "equity_research_team",
    "prompt": "分析 AAPL 2024年Q4财报"
})
```