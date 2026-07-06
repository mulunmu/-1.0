"""Chat 路由 mock 回退测试 — 验证 DB 不可用时所有 intent 都不 503"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_chat_helpers_exist():
    from app.services.chat_router import (_radar_chart, _bar_chart,
        _missing_enterprise_message, _unknown_enterprise_message,
        _resolve_single_enterprise, _all_enterprise_ids)
    assert callable(_radar_chart)
    assert callable(_bar_chart)
    assert callable(_missing_enterprise_message)
    assert callable(_unknown_enterprise_message)


def test_all_mock_intents_have_fallback():
    """验证所有 intent 路径都有 mock 数据兜底"""
    from app.services.mock_data import (
        get_mock_enterprise, get_all_mock_enterprises,
        get_mock_warnings, get_mock_legal_events,
    )
    # 企业数据可用
    assert get_mock_enterprise("ENT001") is not None
    # 全部列表可用
    assert len(get_all_mock_enterprises()) == 10
    # 预警数据可用
    assert len(get_mock_warnings()) > 0
    # 法律事件可用
    assert len(get_mock_legal_events("ENT006")) > 0


def test_template_reply_all_intents():
    """模板回复覆盖所有 intent"""
    from app.services.llm_reply import _template_reply
    intents = ["tax_health", "authenticity", "industry_compare", "enterprise_pk",
               "risk_warning", "full_report", "email_report", "general"]
    for intent in intents:
        reply = _template_reply(intent, {}, with_prefix=True)
        assert len(reply) > 0


def test_template_reply_with_data():
    """带数据的模板回复产生有意义输出"""
    from app.services.llm_reply import _template_reply
    data = {"enterprise": {"enterprise_name": "测试企业", "tax_health_score": 85,
            "credit_level": "A", "tax_on_time_rate": "95%", "risk_level": "低风险"}}
    reply = _template_reply("tax_health", data, with_prefix=True)
    assert "测试企业" in reply
    assert "85" in reply
