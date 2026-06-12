#!/usr/bin/env bash
# scripts/desktop/install-deps.sh <runtime_dir>
# 用 uv 把 agent/requirements.txt(排除 weasyprint)装进内嵌运行时的 site-packages。
set -euo pipefail
RUNTIME_DIR="${1:?usage: install-deps.sh <runtime_dir>}"
PY="$RUNTIME_DIR/bin/python3"
REQ_SRC="agent/requirements.txt"

command -v uv >/dev/null 2>&1 || { echo "uv not found; install via 'pip install uv' or astral installer"; exit 1; }

tmp_req="$(mktemp)"
# 排除 weasyprint(及其直接拉入的 cairo/pango 绑定行,如果 requirements 里有的话)
grep -viE '^\s*weasyprint' "$REQ_SRC" > "$tmp_req"

echo "Installing deps into embedded runtime (weasyprint excluded)"
uv pip install --python "$PY" -r "$tmp_req"
rm -f "$tmp_req"
echo "Done. Installed packages:"
"$PY" -m pip list 2>/dev/null | head -40 || true
