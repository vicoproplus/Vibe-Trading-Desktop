# Brainstorm Summary

- Change: tauri-desktop-client
- Date: 2026-06-12

## 确认的技术方案(用户已逐项拍板)

1. **目标平台**:macOS(arm64 only)+ Windows(x64)。无 universal、无 Intel mac、无交叉编译(各自平台/CI 构建)。
2. **Python 打包**:完整内嵌 python-build-standalone 可重定位运行时 + 预装依赖(排除 weasyprint),离线开箱即用,体积 ~800MB–1.5GB 可接受。
3. **PDF 报告**:降级为 HTML。`reporter.py:304` 已 try/except 降级,打包时不装 weasyprint 即可,**零业务代码改动**。
4. **架构**:webview 指向后端托管的 UI(`http://127.0.0.1:<port>`)。后端生产模式已用 SPAStaticFiles 托管 frontend/dist(`api_server.py:3100-3118`),前端走同源相对路径(`api.ts:3` BASE="")。**前端零改动、零跨域**。
5. **可写路径策略(关键决策)**:首启/升级时把只读 bundle 里的 `agent/` 复制到可写目录(如 `~/.vibe-trading/runtime/agent`),后端从可写副本运行,`__file__` 解析到可写处,`runs/sessions/uploads/.swarm` 自然落在可写位置。**不改后端**。

## 关键发现(代码实证)

- **数据写目录硬编码、无 env 覆盖**:`agent/runs`(api_server.py:41, loop.py:39)、`agent/sessions`(:42)、`agent/uploads`(:43)、`agent/.swarm/runs`(store.py:72)。只读 bundle 必崩 → 由"首启复制"解决。
- `swarm/store.py:67` 注释记录 P03-A:store 路径与 path_utils 白名单分别推导曾导致漂移 → 警示不要碰路径解析,复制方案规避此风险。
- `background_tools.py:14` WORKDIR=parents[2] 作 shell cwd;`core/runner.py:156` 回测子进程找 `.venv/bin/python` 否则回退 sys.executable(=内嵌 Python)→ 需验证回测子进程在内嵌 Python 下自包含。
- `.env` 搜索序:`~/.vibe-trading/.env → AGENT_DIR/.env → $CWD/.env`(llm.py:246)。AGENT_DIR 现指向可写副本;bundle 的 agent/.env 复制为种子;用户可在 `~/.vibe-trading/.env` 覆盖。
- onboarding 仅 `.env` 缺失时触发(main.py:253)→ 已种入 .env 故真开箱即用。
- `/health` 存在(api_server.py:1452)→ Rust 就绪轮询目标。
- `__pycache__` 写在代码旁 → 可写副本支持;内嵌 Python stdlib 设 PYTHONDONTWRITEBYTECODE=1 避免只读处写入。

## 关键取舍与风险

- [头号风险:python-build-standalone 装 scipy/sklearn/duckdb 等重原生包后迁移路径能否 import] → 先打可重定位性 spike,补原生扩展导入冒烟测试(spec 已要求)。
- [次风险:回测子进程能否用内嵌 Python 跑通] → 端到端验证回测路径。
- [首启复制体积/耗时;升级时保留数据子目录的合并逻辑] → 版本标记文件比对;刷新代码但保留 runs/sessions/uploads/.swarm/.env。
- [Windows 进程清理] → Job Object;[不签名首启提示] → 文档说明;[动态端口竞态] → 就绪轮询+超时+可读错误。

## 测试策略

- 可重定位性冒烟测试(迁移路径后 import numpy/scipy/sklearn/duckdb/pandas/Pillow/matplotlib)。
- 端到端:全新无 Python 机器双击 → 加载 → 就绪 → UI → 对话/回测;含回测子进程跑通。
- 进程清理(正常+异常退出无残留)、报告降级、状态持久(升级保留数据)、现有 CLI/Docker 用法不受影响。

## Spec Patch(将回写 delta spec)

- `desktop-shell`:新增需求"首启/升级时准备可写运行目录"(复制 agent/ 到可写处、保留数据子目录、种入 .env),含场景。
- `python-runtime-bundling`:补充"回测子进程使用内嵌 Python 自包含"验收场景。
