#!/usr/bin/env python3
"""Scan project structure — language-agnostic, heuristic-based layer identification.

Input: JSON via stdin with optional "project_path" (default ".")
Output: JSON with layers, build_systems, directory_tree, file_groups, language_dist, agent_review_hint

Layer identification uses path keywords + file-name keywords + directory conventions,
never language-specific file suffixes.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path


def scan(project_path: str = ".") -> dict:
    root = Path(project_path).resolve()
    if not root.exists():
        return {"error": f"Path does not exist: {root}"}

    # ── Build system detection ──
    build_signals = [
        ("package.json", "npm/pnpm (Node.js)"),
        ("Cargo.toml", "Cargo (Rust)"),
        ("pyproject.toml", "PEP 621 (Python)"),
        ("setup.py", "setuptools (Python)"),
        ("requirements.txt", "pip (Python)"),
        ("Dockerfile", "Docker"),
        ("docker-compose.yml", "Docker Compose"),
        ("go.mod", "Go Modules"),
        ("pom.xml", "Maven (Java)"),
        ("build.gradle", "Gradle"),
        ("Makefile", "Make"),
        ("CMakeLists.txt", "CMake"),
    ]
    build_systems = {}
    for filename, label in build_signals:
        candidates = list(root.rglob(filename))
        found = []
        for c in candidates:
            try:
                rel = c.relative_to(root)
            except ValueError:
                continue
            # Only count top-level or one-level-deep
            if len(rel.parts) <= 2:
                found.append(str(rel))
        if found:
            build_systems[label] = found

    # ── Directory tree (aggregated) ──
    dir_tree = defaultdict(list)
    for entry in sorted(root.iterdir()):
        if entry.name.startswith(".") or entry.name in ("node_modules", "target", "__pycache__", ".desktop-build"):
            continue
        if entry.is_dir():
            sub = []
            for sub_entry in sorted(entry.iterdir()):
                if sub_entry.name.startswith(".") or sub_entry.name in ("node_modules", "target", "__pycache__"):
                    continue
                sub.append(sub_entry.name)
            dir_tree[entry.name] = sub[:30]  # cap display
        elif entry.is_file():
            dir_tree["."].append(entry.name)

    # ── Layer identification (heuristic, language-agnostic) ──
    # Signals: path keywords, file-name keywords, dir conventions
    layer_keywords = {
        "backend": ["api", "server", "backend", "agent", "service", "graphql", "rest", "cli"],
        "frontend": ["frontend", "ui", "web", "client", "app", "page", "component", "view"],
        "desktop": ["tauri", "electron", "desktop", "native", "sidecar"],
        "database": ["db", "database", "migration", "schema", "model", "entity", "repository"],
        "infra": ["deploy", "docker", "ci", "k8s", "helm", "terraform", "script", "config"],
        "shared": ["shared", "common", "lib", "util", "helper", "type", "types"],
        "docs": ["doc", "wiki", "guide", "readme", "changelog", "license"],
    }

    all_files = []
    for root_dir, dirs, files in os.walk(str(root)):
        rel_root = os.path.relpath(root_dir, str(root))
        if rel_root == ".":
            rel_root = ""
        # Skip hidden dirs and noise
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "target", "__pycache__", ".desktop-build")]
        for f in files:
            if f.startswith("."):
                continue
            full_path = os.path.join(root_dir, f)
            rel_path = os.path.relpath(full_path, str(root))
            all_files.append(rel_path)

    layers = defaultdict(list)
    for fp in all_files:
        parts = fp.replace("\\", "/").split("/")
        assigned = False
        # Check each keyword group
        for layer_name, keywords in layer_keywords.items():
            if assigned:
                break
            for part in parts:
                part_lower = part.lower()
                # Check if any keyword matches a directory or filename segment
                for kw in keywords:
                    if kw in part_lower or part_lower.startswith(kw):
                        layers[layer_name].append(fp)
                        assigned = True
                        break
                if assigned:
                    break
        if not assigned:
            # Files in root
            if len(parts) == 1:
                layers["root"].append(fp)

    # ── File groups by extension-like patterns ──
    ext_groups = defaultdict(list)
    for fp in all_files:
        name = os.path.basename(fp)
        if "." in name:
            ext = name.rsplit(".", 1)[1].lower()
        else:
            ext = "(no extension)"
        ext_groups[ext].append(fp)

    # ── Language distribution ──
    lang_map = {
        "py": "Python", "js": "JavaScript", "jsx": "JavaScript (JSX)",
        "ts": "TypeScript", "tsx": "TypeScript (TSX)",
        "rs": "Rust", "go": "Go", "java": "Java",
        "kt": "Kotlin", "scala": "Scala", "swift": "Swift",
        "c": "C", "h": "C Header", "cpp": "C++", "hpp": "C++ Header",
        "cs": "C#", "rb": "Ruby", "php": "PHP",
        "sh": "Shell", "bat": "Batch", "ps1": "PowerShell",
        "yaml": "YAML", "yml": "YAML", "json": "JSON",
        "toml": "TOML", "md": "Markdown", "html": "HTML",
        "css": "CSS", "scss": "SCSS", "sass": "SASS",
        "sql": "SQL", "r": "R", "mjs": "JavaScript (ESM)",
        "mts": "TypeScript (ESM)",
    }
    lang_dist = defaultdict(int)
    for ext, files in ext_groups.items():
        lang = lang_map.get(ext, f"Unknown (.{ext})")
        lang_dist[lang] += len(files)

    # ── Agent review hint ──
    hint_parts = []
    for layer_name, files in sorted(layers.items()):
        hint_parts.append(f"  {layer_name}: {len(files)} files")
    hint = "Suggested layers:\n" + "\n".join(hint_parts)
    hint += "\n\nReview these layer assignments for correctness. The heuristic may misclassify files with ambiguous path names."

    return {
        "project_path": str(root),
        "build_systems": build_systems,
        "directory_tree": dict(dir_tree),
        "layers": {k: sorted(v) for k, v in sorted(layers.items())},
        "language_distribution": dict(sorted(lang_dist.items(), key=lambda x: -x[1])),
        "file_count": len(all_files),
        "agent_review_hint": hint,
    }


if __name__ == "__main__":
    raw = sys.stdin.read()
    params = json.loads(raw) if raw.strip() else {}
    project_path = params.get("project_path", ".")
    result = scan(project_path)
    print(json.dumps(result, indent=2, ensure_ascii=False))
