"""意图识别引擎：规则层（优先）+ LLM 语义层（Reference: Financial-Intent-Understanding-with-LLMs）"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()

# Reference: reference/intent_classification.py - OpenFinData 基准验证 Prompt（85.33%）
INTENT_SYSTEM_PROMPT = """你是一个意图分析助手。请分析以下问句的意图类型。

意图类别：
- tax_health：查询企业税务健康、纳税信用、欠税违法
- authenticity：查询经营真实性、营收偏差、发票活跃度
- industry_compare：查询行业排名、同行对比
- risk_warning：查询风险预警信号
- enterprise_pk：对比多家企业
- full_report：生成评估报告
- email_report：发送报告到邮箱
- chat：闲聊

请只输出意图标签（如 tax_health），不要输出其他内容。"""

# Reference: reference/intent_classification.py - 20 条标准测试用例
TEST_CASES: list[tuple[str, str]] = [
    ("分析一下深圳明达科技的税务信用", "tax_health"),
    ("这家企业纳税情况怎么样", "tax_health"),
    ("查一下纳税信用等级", "tax_health"),
    ("有没有欠税记录", "tax_health"),
    ("经营真实吗", "authenticity"),
    ("报给税务局的营收和公开财报对得上吗", "authenticity"),
    ("发票开得多不多", "authenticity"),
    ("跟同行比怎么样", "industry_compare"),
    ("在行业里排第几", "industry_compare"),
    ("同行对比", "industry_compare"),
    ("有什么风险信号", "risk_warning"),
    ("预警清单", "risk_warning"),
    ("哪些企业有风险", "risk_warning"),
    ("对比深圳明达和杭州绿源", "enterprise_pk"),
    ("PK一下ENT001和ENT005", "enterprise_pk"),
    ("生成评估报告", "full_report"),
    ("下载报告", "full_report"),
    ("把报告发到我邮箱", "email_report"),
    ("你好", "chat"),
    ("谢谢", "chat"),
]

GENERIC_FRAGMENTS = {
    "有限", "公司", "股份", "科技", "中国", "集团", "服务", "贸易", "制造", "信息", "物流",
}

VALID_INTENTS = {
    "tax_health",
    "authenticity",
    "industry_compare",
    "risk_warning",
    "enterprise_pk",
    "full_report",
    "email_report",
    "chat",
    "general",
}

INTENT_RULES: list[tuple[str, list[str]]] = [
    ("email_report", ["发送", "邮箱", "邮件", "发邮件", "发到"]),
    ("full_report", ["生成报告", "评估报告", "下载报告"]),
    ("risk_warning", ["风险", "预警", "信号", "警告"]),
    ("enterprise_pk", ["pk", "vs"]),
    ("industry_compare", ["行业", "同行", "排名", "排第", "排行"]),
    ("tax_health", ["税务", "纳税", "信用", "欠税", "税务信用"]),
    ("authenticity", ["真实", "对得上", "偏差", "营收", "发票"]),
]

CHAT_KEYWORDS = ["你好", "您好", "谢谢", "再见", "嗨", "hello", "hi", "在吗"]

# 追问/代词 — 需继承上一轮企业上下文
FOLLOWUP_MARKERS = [
    "那", "它", "这家", "该企业", "这个企业", "这家公司", "上面", "刚才", "之前", "继续",
]

OUTPUT_MAP: dict[str, str] = {
    "tax_health": "score_detail",
    "authenticity": "score_detail",
    "industry_compare": "ranking",
    "enterprise_pk": "pk_compare",
    "risk_warning": "warning_list",
    "full_report": "report_link",
    "email_report": "email_status",
    "general": "overview",
    "chat": "overview",
}

EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
ENT_ID_RE = re.compile(r"ENT\d{3}", re.IGNORECASE)


def _load_companies() -> list[tuple[str, str]]:
    """动态加载企业映射：优先从 DB，回退 mock_data"""
    try:
        import asyncio
        from app.db.session import AsyncSessionLocal
        from sqlalchemy import text

        async def _db_load():
            async with AsyncSessionLocal() as db:
                result = await db.execute(text("SELECT enterprise_id, enterprise_name FROM core_metrics"))
                return [(row[0], row[1]) for row in result.all()]

        companies = asyncio.get_event_loop().run_until_complete(_db_load())
        if companies:
            return companies
    except Exception:
        pass

    # Fallback: 从 mock_data 加载全部企业
    from app.services.mock_data import MOCK_ENTERPRISES
    return [(e["enterprise_id"], e["enterprise_name"]) for e in MOCK_ENTERPRISES]


def _build_aliases(companies: list[tuple[str, str]]) -> dict[str, str]:
    """从企业全称自动生成简称映射"""
    aliases: dict[str, str] = {}
    for eid, name in companies:
        # 去掉后缀生成简称
        for suffix in ["有限公司", "股份有限公司", "集团有限公司", "科技", "集团"]:
            if name.endswith(suffix):
                short = name[: -len(suffix)]
                if len(short) >= 2 and short not in GENERIC_FRAGMENTS:
                    aliases[short] = eid
                break
        # 取前2-3个字作为简称
        if len(name) >= 4:
            aliases[name[:4]] = eid
        if len(name) >= 3:
            aliases[name[:3]] = eid
    return aliases


# 动态加载（模块导入时执行一次）
COMPANIES: list[tuple[str, str]] = _load_companies()
COMPANY_ALIASES: dict[str, str] = _build_aliases(COMPANIES)


@dataclass
class IntentResult:
    intent: str
    enterprises: list[str] = field(default_factory=list)
    enterprise_names: list[str] = field(default_factory=list)
    recipient: str | None = None
    output: str = "overview"
    matched_keywords: list[str] = field(default_factory=list)
    raw_query: str = ""
    source: str = "rules"  # rules | llm


def _normalize_intent(intent: str) -> str:
    intent = intent.strip().lower().replace("-", "_")
    if intent == "chat":
        return "general"
    return intent if intent in VALID_INTENTS else "general"


def _is_llm_configured() -> bool:
    key = os.getenv("LLM_API_KEY", "")
    return bool(key and key != "your-api-key-here")


def extract_enterprises(query: str) -> tuple[list[str], list[str]]:
    found_ids: list[str] = []
    found_names: list[str] = []

    for m in ENT_ID_RE.finditer(query):
        eid = m.group().upper()
        if eid not in found_ids:
            found_ids.append(eid)

    for alias, eid in sorted(COMPANY_ALIASES.items(), key=lambda x: -len(x[0])):
        if alias in query and eid not in found_ids:
            found_ids.append(eid)
            name = get_company_name(eid)
            if name and name not in found_names:
                found_names.append(name)

    for eid, name in COMPANIES:
        if eid in found_ids:
            if name not in found_names:
                found_names.append(name)
            continue
        if name in query:
            found_ids.append(eid)
            found_names.append(name)
            continue
        for length in range(min(len(name), 8), 2, -1):
            for i in range(len(name) - length + 1):
                fragment = name[i : i + length]
                if len(fragment) >= 3 and fragment not in GENERIC_FRAGMENTS and fragment in query:
                    found_ids.append(eid)
                    found_names.append(name)
                    break
            else:
                continue
            break

    return found_ids, found_names


def extract_email(query: str) -> str | None:
    m = EMAIL_RE.search(query)
    return m.group() if m else None


def _match_intent_rules(query: str) -> tuple[str, list[str]]:
    q = query.lower()

    if any(kw in q for kw in CHAT_KEYWORDS) and len(query) <= 8:
        return "general", ["chat"]

    # 筛选/排名类问句（无特定企业）
    if any(p in q for p in ["哪家", "哪些", "有哪些", "有没有哪"]):
        if any(kw in q for kw in ["最差", "最低", "末位", "排名靠后", "情况最差"]):
            return "industry_compare", ["排名"]
        if "信用等级" in q or re.search(r"[abcdm]级", q, re.I):
            return "risk_warning", ["信用等级"]

    # Reference: authenticity 优先于 tax_health（营收对得上类问句）
    if "对得上" in q or ("营收" in q and "财报" in q):
        return "authenticity", ["对得上", "营收"]

    scores: dict[str, list[str]] = {}
    for intent, keywords in INTENT_RULES:
        matched = [kw for kw in keywords if kw in q]
        if matched:
            scores[intent] = matched

    # Reference: 同行对比 → industry_compare（非 enterprise_pk）
    if "同行" in q and "对比" in q:
        return "industry_compare", scores.get("industry_compare", ["同行", "对比"])

    if "对比" in q or "比较" in q:
        ent_ids, _ = extract_enterprises(query)
        if len(ent_ids) >= 2:
            return "enterprise_pk", ["对比"]
        if any(kw in q for kw in ["行业", "同行", "排名"]):
            return "industry_compare", scores.get("industry_compare", ["对比"])

    if not scores:
        return "general", []

    if "email_report" in scores and any(kw in q for kw in ["邮箱", "邮件", "发送", "发到"]):
        return "email_report", scores["email_report"]

    priority = [
        "email_report",
        "full_report",
        "risk_warning",
        "enterprise_pk",
        "industry_compare",
        "tax_health",
        "authenticity",
    ]
    for intent in priority:
        if intent in scores:
            return intent, scores[intent]

    first = next(iter(scores))
    return first, scores[first]


def recognize_llm(query: str) -> str | None:
    """Reference: Financial-Intent-Understanding-with-LLMs - 零样本意图分类"""
    if not _is_llm_configured():
        return None
    try:
        import litellm

        from app.services.llm_reply import _extract_llm_content, _llm_completion_params, _llm_extra_body

        model, llm_params = _llm_completion_params()
        intent_kwargs: dict = {
            "model": model,
            **llm_params,
            "messages": [
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user", "content": f"问句: {query}"},
            ],
            "temperature": 0.0,
            "max_tokens": 20,
            "timeout": 15,
        }
        extra = _llm_extra_body(model)
        if extra:
            intent_kwargs["extra_body"] = extra
        response = litellm.completion(**intent_kwargs)
        raw = _extract_llm_content(response)
        label = raw.split()[0].strip(".,;:")
        return _normalize_intent(label)
    except Exception:
        return None


def is_followup_query(query: str) -> bool:
    """判断是否为省略企业名的追问"""
    q = query.strip()
    if any(marker in q for marker in FOLLOWUP_MARKERS):
        return True
    ent_ids, _ = extract_enterprises(q)
    if not ent_ids and (q.endswith("呢") or q.endswith("呢？")) and len(q) <= 20:
        return True
    return False


def _apply_session_context(
    query: str,
    ent_ids: list[str],
    ent_names: list[str],
    session_context: dict | None,
) -> tuple[list[str], list[str]]:
    """追问时用上一轮 enterprises 补全"""
    if not session_context or ent_ids:
        return ent_ids, ent_names
    if not is_followup_query(query):
        return ent_ids, ent_names

    ctx_ids = session_context.get("enterprises") or []
    ctx_names = session_context.get("enterprise_names") or []
    if not ctx_ids:
        return ent_ids, ent_names

    names = list(ctx_names)
    if len(names) < len(ctx_ids):
        names = [
            get_company_name(eid) or eid
            for eid in ctx_ids
        ]
    return list(ctx_ids), names


def recognize(
    query: str,
    use_llm: bool = True,
    session_context: dict | None = None,
) -> IntentResult:
    """规则层优先；规则不确定且 LLM 可用时走语义层"""
    query = query.strip()
    intent, keywords = _match_intent_rules(query)
    ent_ids, ent_names = extract_enterprises(query)
    ent_ids, ent_names = _apply_session_context(query, ent_ids, ent_names, session_context)
    source = "rules"

    low_confidence = intent == "general" or (not keywords and intent != "general")
    if use_llm and low_confidence:
        llm_intent = recognize_llm(query)
        if llm_intent and llm_intent != "general":
            intent = llm_intent
            source = "llm"
            keywords = ["llm_semantic"]

    recipient = extract_email(query) if intent == "email_report" else None

    return IntentResult(
        intent=intent,
        enterprises=ent_ids,
        enterprise_names=ent_names,
        recipient=recipient,
        output=OUTPUT_MAP.get(intent, "overview"),
        matched_keywords=keywords,
        raw_query=query,
        source=source,
    )


def evaluate(use_llm: bool = False) -> dict:
    """跑 TEST_CASES 评测准确率，目标 >85%"""
    results: list[dict] = []
    correct = 0

    for query, expected in TEST_CASES:
        result = recognize(query, use_llm=use_llm)
        predicted = result.intent
        expected_norm = _normalize_intent(expected)
        ok = predicted == expected_norm
        if ok:
            correct += 1
        results.append(
            {
                "query": query,
                "expected": expected_norm,
                "predicted": predicted,
                "source": result.source,
                "correct": ok,
            }
        )

    total = len(TEST_CASES)
    accuracy = correct / total if total else 0.0
    return {
        "total": total,
        "correct": correct,
        "accuracy": round(accuracy * 100, 2),
        "use_llm": use_llm,
        "passed": accuracy >= 0.85,
        "details": results,
    }


def get_company_name(enterprise_id: str) -> str | None:
    for eid, name in COMPANIES:
        if eid == enterprise_id:
            return name
    return None
