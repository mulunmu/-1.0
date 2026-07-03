"""轻量会话记忆 — 内存存储，30 分钟过期"""
from __future__ import annotations

import time
import uuid
from typing import Any

TTL_SECONDS = 30 * 60

store: dict[str, dict[str, Any]] = {}


def _now() -> float:
    return time.time()


def _is_expired(entry: dict[str, Any]) -> bool:
    return _now() - entry.get("updated_at", 0) > TTL_SECONDS


def _cleanup_expired() -> None:
    for sid in [k for k, v in store.items() if _is_expired(v)]:
        del store[sid]


def ensure_session_id(session_id: str | None) -> str:
    """获取或创建 session_id"""
    _cleanup_expired()
    sid = session_id or str(uuid.uuid4())
    if sid not in store or _is_expired(store[sid]):
        store[sid] = {
            "enterprises": [],
            "enterprise_names": [],
            "last_intent": None,
            "history": [],
            "updated_at": _now(),
        }
    return sid


def get_session(session_id: str | None) -> dict[str, Any] | None:
    """读取会话上下文，过期返回 None"""
    if not session_id:
        return None
    _cleanup_expired()
    entry = store.get(session_id)
    if not entry or _is_expired(entry):
        store.pop(session_id, None)
        return None
    return entry


def store_session(
    session_id: str,
    intent: str,
    enterprises: list[str],
    query: str,
    enterprise_names: list[str] | None = None,
) -> None:
    """写入/更新会话上下文"""
    _cleanup_expired()
    entry = store.get(session_id)
    if not entry or _is_expired(entry):
        entry = {
            "enterprises": [],
            "enterprise_names": [],
            "last_intent": None,
            "history": [],
            "updated_at": _now(),
        }
        store[session_id] = entry

    if enterprises:
        entry["enterprises"] = list(enterprises)
    if enterprise_names:
        entry["enterprise_names"] = list(enterprise_names)
    entry["last_intent"] = intent
    entry["history"].append({"query": query, "intent": intent})
    if len(entry["history"]) > 20:
        entry["history"] = entry["history"][-20:]
    entry["updated_at"] = _now()
