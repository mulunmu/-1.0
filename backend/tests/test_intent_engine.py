"""意图识别引擎单元测试 — 不依赖数据库/LLM"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.intent_engine import recognize, evaluate, _match_intent_rules, extract_enterprises


def test_rule_intent_tax_health():
    intent, keywords = _match_intent_rules("分析深圳明达科技的税务健康")
    assert intent == "tax_health"


def test_rule_intent_authenticity():
    intent, keywords = _match_intent_rules("经营真实吗")
    assert intent == "authenticity"


def test_rule_intent_industry_compare():
    intent, keywords = _match_intent_rules("跟同行比怎么样")
    assert intent == "industry_compare"


def test_rule_intent_risk_warning():
    intent, keywords = _match_intent_rules("有哪些风险预警")
    assert intent == "risk_warning"


def test_rule_intent_enterprise_pk():
    intent, keywords = _match_intent_rules("对比深圳明达和杭州绿源")
    assert intent == "enterprise_pk"


def test_rule_intent_full_report():
    intent, keywords = _match_intent_rules("生成评估报告")
    assert intent == "full_report"


def test_rule_intent_email_report():
    intent, keywords = _match_intent_rules("把报告发到我邮箱")
    assert intent == "email_report"


def test_rule_intent_chat():
    intent, keywords = _match_intent_rules("你好")
    assert intent == "general"


def test_extract_single_enterprise():
    ids, names = extract_enterprises("分析深圳明达科技的税务健康")
    assert "ENT001" in ids


def test_extract_multiple_enterprises():
    ids, names = extract_enterprises("对比深圳明达和杭州绿源")
    assert "ENT001" in ids
    assert "ENT005" in ids


def test_extract_by_id():
    ids, names = extract_enterprises("查询ENT003的详情")
    assert "ENT003" in ids


def test_followup_detection():
    from app.services.intent_engine import is_followup_query
    assert is_followup_query("它呢") is True
    assert is_followup_query("那税务方面呢") is True
    assert is_followup_query("分析深圳明达") is False


def test_evaluate_accuracy():
    result = evaluate(use_llm=False)
    assert result["accuracy"] >= 85.0, f"Accuracy {result['accuracy']}% below 85%"


def test_normalize_intent():
    from app.services.intent_engine import _normalize_intent
    assert _normalize_intent("chat") == "general"
    assert _normalize_intent("tax_health") == "tax_health"
