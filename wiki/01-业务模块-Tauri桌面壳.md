# Tauri 桌面壳模块

## 概述

Tauri 桌面壳模块是 Vibe Trading 的桌面应用容器，将 Python 后端（FastAPI 服务器）和 React 前端（Vite SPA）打包为原生桌面应用。它使用 Tauri v2 框架，嵌入 Python 3.12 运行时作为侧车（sidecar）进程。

**源文件**: `src-tauri/src/` 目录中的 Rust 源码

## 核心架构

### 1. 主入口

`main.rs`（`src-tauri/src/main.rs`）是 Tauri 应用的入口点，负责：

- 解析资源路径
- 选择空闲端口
- 启动 Python 侧车
- 创建 Webview 窗口
- 管理应用生命周期

**启动流程**：
1. 显示 `loading.html` 加载页
2. 解析嵌入式资源路径（`ResourcesResolver`）
3. 首次运行/版本升级时复制 Agent 代码到 `~/.vibe-trading/runtime/agent/`
4. 在端口扫描器中选择空闲端口（`PortPicker`）
5. 启动 Python 侧车：`python3 -c "import cli; cli.main(['serve', ...])"`
6. 健康检查：轮询 `GET /health`（超时 60s）
7. 健康通过后导航 Webview 到 `http://127.0.0.1:<port>/`

### 2. 侧车管理

`sidecar.rs`（`src-tauri/src/sidecar.rs`）管理 Python 子进程生命周期：

- **启动**：设置正确的 `PYTHONPATH` 环境变量，指向嵌入式 Python 运行时的 site-packages
- **健康检查**：异步轮询 `/health` 端点
- **终止**：进程退出时通过 `killpg(SIGTERM)` 发送信号到整个进程组
- **超时处理**：uvicorn 设置 `timeout_graceful_shutdown=5` 确保优雅退出

### 3. 资源管理

`resources.rs`（`src-tauri/src/resources.rs`）处理嵌入式资源：

- 解析 Tauri 打包的资源路径
- 首次运行复制逻辑：将 Agent 代码从 bundle 复制到用户目录
- 版本检查：比较当前版本与已安装版本

### 4. 运行时目录

`runtime_dir.rs`（`src-tauri/src/runtime_dir.rs`）管理 `~/.vibe-trading/runtime/` 目录：

- 目录结构初始化
- 版本文件管理（`VERSION` 文件）
- 子目录创建（`agent/`, `logs/`, `libs/`）

### 5. 端口管理

`port.rs`（`src-tauri/src/port.rs`）检测可用端口：

- 绑定 `127.0.0.1` 的随机端口
- 确保端口未被占用
- 返回可用端口号

### 6. 版本管理

`version.rs`（`src-tauri/src/version.rs`）处理版本比较：

- 读取 `VERSION` 文件
- 语义化版本比较
- 版本升级检测

## 构建配置

`tauri.conf.json`（`src-tauri/tauri.conf.json`）配置：

- 应用标识符：`ai.vibetrading.desktop`
- Bundle 资源路径：`.desktop-build/python-runtime`, `.desktop-build/agent`, `frontend/dist`
- 窗口配置：标题、尺寸、图标
- 安全配置：CSP 策略、能力权限

## 构建与打包

桌面构建需要先组装资源（`.desktop-build/`），然后运行 Tauri 构建：

```bash
# Windows (PowerShell)
./scripts/desktop/build-windows.ps1

# macOS
bash scripts/desktop/build-dmg.sh
```

**使用场景**:
```bash
# 开发模式启动
cargo tauri dev

# 生产构建
cargo tauri build
```