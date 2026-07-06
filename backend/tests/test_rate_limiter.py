"""速率限制器单元测试"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.rate_limiter import check_api_limit, record_api_call


def test_api_limit_allows_requests():
    """初始状态应允许请求"""
    for _ in range(5):
        assert check_api_limit()
        record_api_call()


def test_llm_daily_limit():
    from app.services.rate_limiter import check_llm_limit, increment_llm, get_llm_usage
    assert check_llm_limit()
    usage = get_llm_usage()
    assert "used" in usage
    assert usage["limit"] == 100


def test_get_llm_usage_structure():
    from app.services.rate_limiter import get_llm_usage
    usage = get_llm_usage()
    assert isinstance(usage, dict)
    assert "date" in usage
    assert "remaining" in usage
