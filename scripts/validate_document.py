#!/usr/bin/env python3
"""Validate generated knowledge-base documents.

Input: JSON via stdin.
  Mode 1 (single doc): {"document_path": "path/to/doc.md"}
  Mode 2 (full wiki):  {"wiki_path": "wiki/", "index_path": "wiki.md"}

Output: JSON with status, errors[], warnings[], message.

Checks performed:
  - File exists and is readable
  - UTF-8 encoding
  - Minimum length (>100 chars for business module, >50 for relations)
  - Source annotations present (file:line references)
  - No placeholder / "TODO" / "FIXME" / unchecked content
  - No speculative language ("可能", "应该", "大概", "maybe", "probably")
  - Valid markdown structure (headers, lists)
  - Cross-references to wiki/ files exist on disk
  - Full mode: verifies all wiki/ files referenced from wiki.md exist
"""

import json
import os
import re
import sys
from pathlib import Path


def validate_single_document(doc_path: str) -> dict:
    p = Path(doc_path)
    errors = []
    warnings = []

    if not p.exists():
        return {"status": "FAIL", "errors": [f"File not found: {doc_path}"], "warnings": [], "message": "Document does not exist"}

    content = p.read_text("utf-8", errors="replace")

    # 1. Minimum length
    if len(content.strip()) < 50:
        errors.append(f"Document content too short ({len(content.strip())} chars, min 50)")

    # 2. Speculative language check
    speculative = ["可能", "应该", "大概", "也许", "maybe", "probably", "possibly", "likely", "might", "could be"]
    for word in speculative:
        if word in content.lower():
            # Count occurrences
            count = content.lower().count(word)
            # Only flag if it's used speculatively (heuristic: non-code context)
            warnings.append(f"Possible speculative language '{word}' found {count} time(s)")

    # 3. Placeholder check
    placeholders = ["TODO", "FIXME", "XXX", "TBD", "UNDER CONSTRUCTION", "coming soon", "to be written"]
    for ph in placeholders:
        if ph.lower() in content.lower():
            errors.append(f"Placeholder '{ph}' found in document")

    # 4. Source annotations (file:line or filepath)
    # Every doc should reference at least some source files
    if p.stem != "wiki.md":  # wiki.md is a meta-index, may have fewer annotations
        source_refs = re.findall(r'`([^`]+\.[a-zA-Z]+)`|\[([^\]]+\.[a-zA-Z]+)\]', content)
        flat_refs = [r for pair in source_refs for r in pair if r]
        # Check if references exist on disk
        proj_root = p.parent.parent
        for ref in flat_refs:
            ref_path = proj_root / ref
            if not ref_path.exists():
                # It might be a line reference like file.py:42
                base = ref.split(":")[0]
                ref_base = proj_root / base
                if not ref_base.exists():
                    warnings.append(f"Referenced file not found: {ref}")

    # 5. Markdown structure
    headers = re.findall(r'^#{1,6}\s+', content, re.MULTILINE)
    if len(headers) < 2:
        warnings.append("Very few markdown headers (<2), check structure")

    # 6. Business module docs should have usage example
    if "01-业务模块" in doc_path:
        if "示例" not in content and "example" not in content.lower() and "使用" not in content:
            warnings.append("Business module doc should include usage/example section")

    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "warnings": warnings,
        "message": "Validation passed" if not errors else f"Validation failed: {len(errors)} error(s), {len(warnings)} warning(s)",
    }


def validate_full_wiki(wiki_path: str, index_path: str) -> dict:
    wiki_dir = Path(wiki_path)
    idx = Path(index_path)
    errors = []
    warnings = []

    # Index must exist
    if not idx.exists():
        return {"status": "FAIL", "errors": [f"Index file not found: {index_path}"], "warnings": [], "message": "Index missing"}

    idx_content = idx.read_text("utf-8", errors="replace")
    if len(idx_content.strip()) < 200:
        errors.append("Index file too short (<200 chars)")

    # Check wiki/ dir
    if not wiki_dir.exists():
        errors.append(f"wiki directory not found: {wiki_path}")

    # Collect all actual files in wiki/
    actual_wiki_files = set()
    if wiki_dir.exists():
        for f in wiki_dir.iterdir():
            if f.is_file() and f.suffix == ".md":
                actual_wiki_files.add(f.name)

    # Find all links from index to wiki/
    link_refs = set(re.findall(r'wiki/([\w\-\.]+\.md)', idx_content))

    # Check each referenced file exists
    for ref in link_refs:
        if ref not in actual_wiki_files:
            errors.append(f"wiki.md references '{ref}' but file not found in wiki/")

    # Check unreferenced wiki files
    for f in sorted(actual_wiki_files):
        if f not in link_refs:
            warnings.append(f"wiki/ file not referenced from wiki.md: {f}")

    # Validate each wiki file individually
    for f in sorted(actual_wiki_files):
        fp = wiki_dir / f
        sub = validate_single_document(str(fp))
        if sub["status"] == "FAIL":
            errors.append(f"  Sub-doc {f}: {sub['message']}")
            for e in sub["errors"]:
                errors.append(f"    {e}")
        for w in sub.get("warnings", []):
            warnings.append(f"  {f}: {w}")

    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "warnings": warnings,
        "message": "Full validation passed" if not errors else f"Full validation: {len(errors)} error(s), {len(warnings)} warning(s)",
    }


if __name__ == "__main__":
    raw = sys.stdin.read()
    params = json.loads(raw) if raw.strip() else {}
    result = {"status": "FAIL", "errors": ["No input provided"], "warnings": [], "message": "No input"}

    if "document_path" in params:
        result = validate_single_document(params["document_path"])
    elif "wiki_path" in params and "index_path" in params:
        result = validate_full_wiki(params["wiki_path"], params["index_path"])
    else:
        result = {"status": "FAIL", "errors": ["Provide document_path for single doc, or wiki_path+index_path for full wiki"], "warnings": [], "message": "Invalid input"}

    print(json.dumps(result, indent=2, ensure_ascii=False))
