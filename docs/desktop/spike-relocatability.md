# 可重定位性 Spike 记录

> 目标: 验证 python-build-standalone `install_only` 产物在 macOS arm64 上可重定位使用,即解压后移动到任意路径仍能正常 import 原生扩展并启动后端。

## 运行时选型

| 项目 | 值 |
|---|---|
| Release Tag | `20260610` |
| Python 版本 | 3.12.13 |
| 资产文件名 | `cpython-3.12.13+20260610-aarch64-apple-darwin-install_only.tar.gz` |
| 目标平台 | macOS aarch64 (Apple Silicon) |
| 选型理由 | 3.12.x 满足 `requires-python >= 3.11`, 且比 3.11 有更好的性能与错误信息; 选用最新稳定 release tag `20260610` |

**获取命令:**
```bash
PBS_TAG=20260610 \
PBS_ASSET=cpython-3.12.13+20260610-aarch64-apple-darwin-install_only.tar.gz \
bash scripts/desktop/fetch-runtime.sh
```

## 依赖安装

> 待 Task 2 完成后填写。

## 冒烟结论

> 待 Task 3 完成后填写。

## serve / 回测冒烟

> 待 Task 4 完成后填写。
