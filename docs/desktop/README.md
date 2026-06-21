# Vibe Trading Desktop

Vibe Trading 桌面客户端，基于 Tauri 2.x 封装，双击即用，无需安装 Python。

## 系统要求

- **macOS**: 12.0+ (Apple Silicon 原生)
- **Windows**: Windows 10+ (x64)
- **磁盘空间**: ~1GB（安装后）

## 安装

### macOS
1. 下载 `Vibe Trading_*.dmg`
2. 双击挂载 DMG，拖拽 `Vibe Trading.app` 到 `/Applications`
3. **清除"已损坏"隔离标记**（当前未签名版本的必做步骤）：

   应用目前未做 Apple 代码签名与公证，经浏览器下载后双击会报"已损坏，无法打开"。打开"终端"（Spotlight 搜索 `Terminal` 或 `终端`），粘贴下面命令并回车：

   ```bash
   xattr -cr "/Applications/Vibe Trading.app"
   ```

   > 此命令仅清除这一个应用的"从网络下载"隔离标记，**不会**修改任何系统设置、也**不影响**其他应用，可放心执行。
4. **首次启动**：右键点击应用 → "打开" → 确认弹窗点"打开"
5. 后续启动直接双击即可

> 提示：若双击 DMG 本身就提示损坏，先对 dmg 执行 `xattr -cr ~/Downloads/Vibe\ Trading-*.dmg` 再挂载。

### Windows
1. 下载 `Vibe Trading_*_x64-setup.exe`
2. 双击安装
3. 首次启动可能触发 SmartScreen 警告 → 点击"更多信息" → "仍然运行"

## 状态与配置

- **状态目录**: `~/.vibe-trading/`
  - `runtime/agent` — 后端代码副本（升级时自动刷新）
  - `.env` — 用户配置（API 密钥等，首次启动自动创建）
- **后端端口**: 每次启动动态分配，仅绑定 `127.0.0.1`
- **进程清理**: 关闭窗口自动终止所有后端子进程

## 已知限制

- **未签名**: macOS 需先执行 `xattr -cr` 清除隔离标记（见上方安装步骤），Windows 触发 SmartScreen
- **体积 (~800MB)**: 内嵌完整 Python 运行时与所有依赖
- **PDF 报告降级为 HTML**: 因不打包 weasyprint（~200MB），影子账户报告降级为 HTML 输出
- **无自动更新**: 需手动下载新版本
- **仅限 127.0.0.1**: 后端仅监听本机回环地址
- **Apple Silicon only (macOS)**: x64 macOS 需交叉编译（CI 未覆盖）

## 开发

### 构建

**Windows 一键构建**（推荐）：

```powershell
.\scripts\desktop\build-windows.ps1
```

该脚本端到端完成：前置检查 → 拉取 Python runtime → 装依赖 → 组装资源 → `cargo tauri build --bundles nsis` → 归档安装包到 `release/`。前置依赖：`node`/`npm`、`cargo`、`cargo-tauri`（`cargo install tauri-cli --version "^2"`）、`uv`（`pip install uv`）。

**手动分步构建**（macOS / 调试用）：

1. 安装 Rust + Tauri CLI: `cargo install tauri-cli`
2. 准备运行时: `bash scripts/desktop/fetch-runtime.sh && bash scripts/desktop/install-deps.sh .desktop-build/python-runtime`
3. 装配资源: `bash scripts/desktop/assemble.sh`
4. 构建: `cd src-tauri && cargo tauri build`

### 技术栈
- Tauri 2.x (Rust)
- python-build-standalone (嵌入运行时)
- FastAPI/uvicorn (后端)
- React + Vite (前端)

## 安全

- 后端仅绑定 `127.0.0.1`，外部网络不可达
- 应用退出时终止所有子进程，无残留
- 用户配置（API 密钥）存储在 `~/.vibe-trading/.env`，不与应用打包
