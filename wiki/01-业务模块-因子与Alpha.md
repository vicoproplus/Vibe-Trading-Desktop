# 因子与 Alpha 模块

## 概述

因子与 Alpha 模块提供因子计算、基准测试、Alpha 对比分析等量化研究能力。内置 3 个因子库（Alpha101、GTJA191、Qlib158）加 10+ 学术因子，支持自定义因子开发和全面的因子分析流水线。

**源文件**: `agent/src/factors/` 和 `agent/src/factors/zoo/` 目录

## 核心组件

### 1. 因子基类

`BaseFactor` 定义在 `agent/src/factors/base.py`，是所有因子的抽象基类。

**核心接口**：
- `name`：因子名称标识
- `calculate(data, **params)`：计算因子值
- `description`：因子描述

### 2. 内置因子库

| 因子库 | 目录 | 因子数量 | 说明 |
|--------|------|----------|------|
| Alpha101 | `agent/src/factors/zoo/alpha101/` | 101 | WorldQuant 101 Alpha 因子 |
| GTJA191 | `agent/src/factors/zoo/gtja191/` | 191 | 国泰君安 191 因子 |
| Qlib158 | `agent/src/factors/zoo/qlib158/` | 158 | Microsoft Qlib 158 因子 |
| Academic | `agent/src/factors/zoo/academic/` | 10 | 学术因子（Carhart 动量、Fama-French 等） |

注册中心在 `agent/src/factors/registry.py`，自动发现和注册所有因子。

### 3. 基准测试

`bench_runner.py` 和 `bench_runner_strict.py` 提供因子基准对比：

- 计算因子值并统计分布
- IC（信息系数）分析
- 分层回测（Decile 分组）
- 换手率分析
- 因子收益衰减

### 4. Alpha 对比

`compare_runner.py` 支持多个 Alphas 之间的对比：

- 日收益率相关性矩阵
- 累计收益对比图
- 最大回撤对比
- 夏普比率对比

### 5. Alpha Zoo API

`alpha_routes.py`（`agent/src/api/alpha_routes.py`）提供 Alpha Zoo 的 HTTP API，支持在前端浏览、搜索、筛选 Alpha 因子。

### 6. 因子分析工具

`factor_analysis_core.py` 提供深度分析：

- IC 分析（Spearman/Pearson）
- 分组收益分析
- 多空组合分析
- 行业中性化
- 市值中性化

**使用场景**:
```bash
# CLI 因子分析
vibe-trading alpha list          # 查看可用因子
vibe-trading alpha bench alpha_001  # 因子基准测试
vibe-trading alpha compare alpha_001 alpha_002  # 因子对比
```

```python
from src.factors.zoo.alpha101.alpha_001 import Alpha001

factor = Alpha001()
result = factor.calculate(data=price_data)
```