#!/usr/bin/env bash
# scripts/desktop/fetch-runtime.sh
# 下载 python-build-standalone (install_only) 并解压到指定目录。
# 用法: PBS_TAG=xxx PBS_ASSET=xxx bash scripts/desktop/fetch-runtime.sh [输出目录]
set -euo pipefail

: "${PBS_TAG:?set PBS_TAG}"
: "${PBS_ASSET:?set PBS_ASSET}"
OUT_DIR="${1:-./.desktop-build/python-runtime}"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/${PBS_ASSET}"

mkdir -p "$(dirname "$OUT_DIR")"
tmp="$(mktemp -d)"
echo "Downloading $URL"
curl -fsSL "$URL" -o "$tmp/runtime.tar.gz"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
# install_only 解包后顶层是 python/, 展平到 OUT_DIR
tar -xzf "$tmp/runtime.tar.gz" -C "$tmp"
mv "$tmp/python/"* "$OUT_DIR/"
rm -rf "$tmp"
echo "Runtime ready at: $OUT_DIR"
"$OUT_DIR/bin/python3" --version
