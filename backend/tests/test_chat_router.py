"""Chat 路由服务单元测试"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_chart_helpers():
    from app.services.chat_router import _radar_chart, _bar_chart
    ent = {"enterprise_name": "Test", "dimensions": {"tax_health": 80, "authenticity": 70, "industry": 75, "legal": 85, "finance": 65}}
    radar = _radar_chart(ent)
    assert radar["type"] == "radar"
    assert len(radar["data"]["values"]) == 5

    items = [{"enterprise_name": "A", "overall_score": 90}, {"enterprise_name": "B", "overall_score": 75}]
    bar = _bar_chart(items)
    assert bar["type"] == "bar"
    assert len(bar["data"]["labels"]) == 2


def test_missing_enterprise_message():
    from app.services.chat_router import _missing_enterprise_message
    msg = _missing_enterprise_message("tax_health")
    assert "企业名称" in msg or "指定" in msg


def test_unknown_enterprise_message():
    from app.services.chat_router import _unknown_enterprise_message
    msg = _unknown_enterprise_message()
    assert "样本库" in msg and "暂未收录" in msg
