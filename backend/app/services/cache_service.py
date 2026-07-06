"""缓存服务 — 演示阶段内存实现，生产切换 Redis"""
from __future__ import annotations

import json
import os
import time
from typing import Any

# 环境变量控制：设置 REDIS_URL 即启用 Redis
REDIS_URL = os.getenv("REDIS_URL", "")

if REDIS_URL:
    try:
        import redis.asyncio as redis
        _client = redis.from_url(REDIS_URL)
    except Exception:
        _client = None
else:
    _client = None

# 内存回退
_store: dict[str, tuple[Any, float | None]] = {}


async def get(key: str) -> Any | None:
    if _client:
        try:
            raw = await _client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            pass
    entry = _store.get(key)
    if entry is None:
        return None
    val, expires_at = entry
    if expires_at and time.time() > expires_at:
        del _store[key]
        return None
    return val


async def set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    if _client:
        try:
            await _client.setex(key, ttl_seconds, json.dumps(value, default=str))
            return
        except Exception:
            pass
    expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
    _store[key] = (value, expires_at)


async def delete(key: str) -> None:
    if _client:
        try:
            await _client.delete(key)
            return
        except Exception:
            pass
    _store.pop(key, None)


def is_redis_available() -> bool:
    return _client is not None
