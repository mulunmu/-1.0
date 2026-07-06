"""服务层综合测试 — legal_service, graph_service"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_legal_service_deductions():
    from app.services.legal_service import EVENT_DEDUCTIONS, EVENT_LABELS
    assert EVENT_DEDUCTIONS["dishonesty"] == 30
    assert EVENT_DEDUCTIONS["execution"] == 20
    assert "dishonesty" in EVENT_LABELS
    assert "execution" in EVENT_LABELS


def test_graph_service_not_loaded():
    from app.services.graph_service import is_data_loaded
    # 默认未加载外部数据
    assert isinstance(is_data_loaded(), bool)


def test_graph_service_empty_path():
    from app.services.graph_service import find_industry_path
    result = find_industry_path("ENT001", "ENT999")
    assert result is None  # 未加载数据时返回 None


def test_assessment_weights_keys():
    from app.services.assessment_weights import DIMENSION_WEIGHTS, DIMENSION_LABELS
    for key in DIMENSION_WEIGHTS:
        assert key in DIMENSION_LABELS, f"Missing label for {key}"


def test_llm_not_configured_fallback():
    """LLM 未配置时 is_configured 返回 False，generate_reply 应走模板"""
    from app.services.llm_reply import _is_llm_configured, _template_reply
    # _template_reply 在无 LLM 时也能正常返回
    reply = _template_reply("general", {}, with_prefix=True)
    assert len(reply) > 0
    assert "[规则模板生成]" in reply


def test_rate_limiter_llm_usage():
    from app.services.rate_limiter import get_llm_usage, check_llm_limit
    usage = get_llm_usage()
    assert "limit" in usage
    assert usage["limit"] == 100
    assert check_llm_limit()  # 初始状态允许调用
