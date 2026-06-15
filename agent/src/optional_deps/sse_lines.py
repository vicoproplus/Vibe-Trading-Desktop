"""SSE frame formatting for the optional-deps install stream.

Frames use the standard ``event: <name>\ndata: <json>\n\n`` shape so
the browser ``EventSource`` (or our fetch-based reader) dispatches them
to typed listeners. ``data`` is always a single-line JSON blob so we
never emit a raw newline inside the data field.
"""

from __future__ import annotations

import json
from typing import Any, Dict


def sse_event(event: str, data: Dict[str, Any]) -> str:
    """Format one SSE frame.

    Args:
        event: The SSE event name (``progress`` / ``done`` / ``failed``).
        data: JSON-serializable payload.

    Returns:
        A frame string ending in ``\\n\\n``.
    """
    # ensure_ascii=False keeps Chinese mirror/source names readable in the
    # browser console; json.dumps escapes any embedded newlines to ``\\n``
    # so the SSE data line stays single-line.
    body = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {body}\n\n"


def stage_line(stage: str, message: str = "") -> str:
    """Convenience wrapper for a ``progress`` frame carrying a stage + line."""
    return sse_event("progress", {"stage": stage, "message": message})
