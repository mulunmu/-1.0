"""LLM 调用次数限制 — 每日上限，防止费用失控"""
from __future__ import annotations

from datetime import date

DAILY_LIMIT = 100

_counters: dict[str, int] = {}


def _today_key() -> str:
    return date.today().isoformat()


def _reset_if_new_day() -> None:
    today = _today_key()
    stale = [k for k in _counters if k != today]
    for k in stale:
        del _counters[k]
    _counters.setdefault(today, 0)


def check_limit() -> bool:
    """是否允许继续调用 LLM"""
    _reset_if_new_day()
    return _counters[_today_key()] < DAILY_LIMIT


def increment() -> int:
    """LLM 调用成功后计数 +1，返回当日已用次数"""
    _reset_if_new_day()
    key = _today_key()
    _counters[key] = _counters.get(key, 0) + 1
    return _counters[key]


def get_usage() -> dict:
    _reset_if_new_day()
    used = _counters.get(_today_key(), 0)
    return {"date": _today_key(), "used": used, "limit": DAILY_LIMIT, "remaining": max(0, DAILY_LIMIT - used)}
