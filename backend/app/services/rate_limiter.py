"""调用次数限制 — LLM 每日上限 + 通用 API 速率限制

生产环境接入 Redis：
  1. 设置环境变量 REDIS_URL=redis://...
  2. from app.services.cache_service import get, set, is_redis_available
  3. 将 _llm_counters / _request_timestamps 替换为 cache get/set
  4. cache_service 已在 app/services/cache_service.py 就绪
"""
from __future__ import annotations

import time
from datetime import date

# LLM 每日上限
LLM_DAILY_LIMIT = 100
_llm_counters: dict[str, int] = {}

# 通用 API 速率限制（每秒请求数）
API_RATE_PER_SECOND = 20
_request_timestamps: list[float] = []


def _today_key() -> str:
    return date.today().isoformat()


def _reset_if_new_day() -> None:
    today = _today_key()
    stale = [k for k in _llm_counters if k != today]
    for k in stale:
        del _llm_counters[k]
    _llm_counters.setdefault(today, 0)


def check_llm_limit() -> bool:
    """是否允许继续调用 LLM"""
    _reset_if_new_day()
    return _llm_counters[_today_key()] < LLM_DAILY_LIMIT


def increment_llm() -> int:
    """LLM 调用成功后计数 +1，返回当日已用次数"""
    _reset_if_new_day()
    key = _today_key()
    _llm_counters[key] = _llm_counters.get(key, 0) + 1
    return _llm_counters[key]


def get_llm_usage() -> dict:
    _reset_if_new_day()
    used = _llm_counters.get(_today_key(), 0)
    return {"date": _today_key(), "used": used, "limit": LLM_DAILY_LIMIT, "remaining": max(0, LLM_DAILY_LIMIT - used)}


def check_api_limit() -> bool:
    """通用 API 速率限制 — 滑动窗口"""
    now = time.time()
    cutoff = now - 1.0
    # 清理过期记录
    while _request_timestamps and _request_timestamps[0] < cutoff:
        _request_timestamps.pop(0)
    return len(_request_timestamps) < API_RATE_PER_SECOND


def record_api_call() -> None:
    """记录一次 API 调用"""
    _request_timestamps.append(time.time())


# 向后兼容别名
check_limit = check_llm_limit
increment = increment_llm
