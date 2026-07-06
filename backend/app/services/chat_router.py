"""AI 对话路由：意图识别 → 模块调用 → LLM/模板回复"""
from __future__ import annotations

import logging
import re

from sqlalchemy import select

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core_metrics import CoreMetrics
from app.services import assessment, email_service, intent_engine, llm_reply, report_generator


async def _all_enterprise_ids(db: AsyncSession) -> list[str]:
    try:
        result = await db.execute(select(CoreMetrics.enterprise_id))
        rows = [row[0] for row in result.all()]
        if rows:
            return rows
    except Exception:
        pass
    # Fallback to mock data
    from app.services.mock_data import MOCK_ENTERPRISES
    return [e["enterprise_id"] for e in MOCK_ENTERPRISES]


def _radar_chart(ent: dict) -> dict:
    dims = ent.get("dimensions", {})
    return {
        "type": "radar",
        "data": {
            "indicators": [
                {"name": "税务健康", "max": 100},
                {"name": "经营真实性", "max": 100},
                {"name": "行业地位", "max": 100},
                {"name": "法律合规", "max": 100},
                {"name": "财务健康", "max": 100},
            ],
            "values": [
                dims.get("tax_health", 0),
                dims.get("authenticity", 0),
                dims.get("industry", 0),
                dims.get("legal", 0),
                dims.get("finance", 0),
            ],
            "name": ent.get("enterprise_name", ""),
        },
    }


def _bar_chart(items: list[dict], metric: str = "overall_score", title: str = "综合分") -> dict:
    return {
        "type": "bar",
        "data": {
            "labels": [i["enterprise_name"] for i in items],
            "series": [{"name": title, "values": [i.get(metric, 0) for i in items]}],
        },
    }


async def _resolve_single_enterprise(
    db: AsyncSession, ent_ids: list[str]
) -> tuple[str | None, dict | None]:
    if ent_ids:
        try:
            ent = await assessment.calculate(db, ent_ids[0])
            if ent:
                return (ent_ids[0], ent)
        except Exception:
            pass
        # Fallback to mock data when DB unavailable
        from app.services.mock_data import get_mock_enterprise
        mock = get_mock_enterprise(ent_ids[0])
        if mock:
            return (ent_ids[0], mock)
    return None, None


def _missing_enterprise_message(intent: str) -> str:
    hints = {
        "tax_health": "请指定企业名称，例如：分析深圳明达科技的税务健康",
        "authenticity": "请指定企业名称，例如：分析杭州绿源的经营真实性",
        "full_report": "请指定企业名称后再生成报告，例如：生成深圳明达的评估报告",
        "email_report": "请指定企业名称，例如：把深圳明达的报告发到 user@example.com",
    }
    return hints.get(intent, "请指定企业名称，例如：分析深圳明达科技的税务健康")


def _unknown_enterprise_message() -> str:
    return (
        "样本库中暂未收录该企业，当前可查深圳明达、上海恒信、北京智云等共10家样本企业。"
        "请指定企业名称后重试。"
    )


async def route_chat(
    db: AsyncSession,
    query: str,
    session_id: str | None = None,
) -> dict:
    from app.services import session_store

    sid = session_store.ensure_session_id(session_id)
    session_context = session_store.get_session(sid)

    intent_result = intent_engine.recognize(query, session_context=session_context)
    intent = intent_result.intent
    data: dict = {}
    charts: dict | None = None

    if intent == "tax_health":
        eid, ent = await _resolve_single_enterprise(db, intent_result.enterprises)
        if not ent:
            msg = _unknown_enterprise_message() if intent_result.enterprises else _missing_enterprise_message("tax_health")
            data = {"message": msg}
        else:
            data = {
                "enterprise": {
                    "enterprise_id": ent["enterprise_id"],
                    "enterprise_name": ent["enterprise_name"],
                    "credit_level": ent["credit_level"],
                    "tax_on_time_rate": f"{ent['tax_on_time_rate'] * 100:.1f}%",
                    "tax_health_score": ent["dimensions"]["tax_health"],
                    "risk_level": ent["risk_level"],
                    "overall_score": ent["overall_score"],
                    "warning_signals": ent["warning_signals"],
                }
            }
            charts = _radar_chart(ent)

    elif intent == "authenticity":
        eid, ent = await _resolve_single_enterprise(db, intent_result.enterprises)
        if not ent:
            msg = _unknown_enterprise_message() if intent_result.enterprises else _missing_enterprise_message("authenticity")
            data = {"message": msg}
        else:
            data = {
                "enterprise": {
                    "enterprise_id": ent["enterprise_id"],
                    "enterprise_name": ent["enterprise_name"],
                    "authenticity_score": ent["dimensions"]["authenticity"],
                    "revenue_deviation": f"{ent['revenue_deviation'] * 100:.2f}%",
                    "invoice_monthly_avg": ent["invoice_monthly_avg"],
                    "social_trend": ent["social_trend"],
                    "risk_level": ent["risk_level"],
                }
            }
            charts = _radar_chart(ent)

    elif intent == "industry_compare":
        all_ids = await _all_enterprise_ids(db)
        try:
            all_scores = await assessment.calculate_pk(db, all_ids)
        except Exception:
            from app.services.mock_data import MOCK_ENTERPRISES
            all_scores = [dict(e) for e in MOCK_ENTERPRISES]
        ranking = sorted(all_scores, key=lambda x: x["overall_score"], reverse=True)
        avg = sum(s["overall_score"] for s in ranking) / max(len(ranking), 1)
        data = {
            "ranking": [
                {
                    "rank": i + 1,
                    "enterprise_id": s["enterprise_id"],
                    "enterprise_name": s["enterprise_name"],
                    "overall_score": s["overall_score"],
                    "risk_level": s["risk_level"],
                    "dimensions": s["dimensions"],
                }
                for i, s in enumerate(ranking)
            ],
            "avg_score": round(avg, 2),
        }
        charts = _bar_chart(ranking[:5])

    elif intent == "enterprise_pk":
        ent_ids = list(intent_result.enterprises)
        all_ids = await _all_enterprise_ids(db)
        if len(ent_ids) < 2 and ent_ids:
            others = [i for i in all_ids if i != ent_ids[0]][:1]
            ent_ids = [ent_ids[0], others[0]] if others else ent_ids
        if len(ent_ids) < 2 and len(all_ids) >= 2:
            ent_ids = all_ids[:2]
        try:
            comparison = await assessment.calculate_pk(db, ent_ids[:5])
        except Exception:
            from app.services.mock_data import get_mock_enterprise
            comparison = [get_mock_enterprise(eid) for eid in ent_ids[:5]]
            comparison = [c for c in comparison if c]
        comparison.sort(key=lambda x: x["overall_score"], reverse=True)
        if len(comparison) < 2:
            data = {"message": "请指定至少两家企业，如：对比深圳明达和上海恒信"}
        else:
            data = {"comparison": comparison}
            charts = {
                "type": "bar",
                "data": {
                    "labels": [c["enterprise_name"] for c in comparison],
                    "series": [
                        {"name": "税务健康", "values": [c["dimensions"]["tax_health"] for c in comparison]},
                        {"name": "经营真实性", "values": [c["dimensions"]["authenticity"] for c in comparison]},
                        {"name": "行业地位", "values": [c["dimensions"]["industry"] for c in comparison]},
                        {"name": "法律合规", "values": [c["dimensions"]["legal"] for c in comparison]},
                        {"name": "财务健康", "values": [c["dimensions"]["finance"] for c in comparison]},
                    ],
                },
            }

    elif intent == "risk_warning":
        credit_match = re.search(r"信用等级\s*([ABCDM])|([ABCDM])级", query, re.I)
        if credit_match:
            level = (credit_match.group(1) or credit_match.group(2)).upper()
            try:
                result = await db.execute(select(CoreMetrics).where(CoreMetrics.credit_level == level))
                rows = list(result.scalars().all())
            except Exception:
                from app.services.mock_data import MOCK_ENTERPRISES
                rows = [type("M",(),{"enterprise_id":e["enterprise_id"],"enterprise_name":e["enterprise_name"],"credit_level":e["credit_level"]})() for e in MOCK_ENTERPRISES if e["credit_level"]==level]
            enterprises = []
            for m in rows:
                try:
                    ent = await assessment.calculate(db, m.enterprise_id)
                except Exception:
                    from app.services.mock_data import get_mock_enterprise
                    ent = get_mock_enterprise(m.enterprise_id) or {"overall_score": 0}
                enterprises.append(
                    {
                        "enterprise_id": m.enterprise_id,
                        "enterprise_name": m.enterprise_name,
                        "credit_level": m.credit_level,
                        "overall_score": ent["overall_score"],
                    }
                )
            data = {
                "filter_credit_level": level,
                "enterprises": enterprises,
            }
            charts = {"type": "bar", "data": {"labels": [e["enterprise_name"] for e in data["enterprises"]], "series": [{"name": f"信用{level}级", "values": [e["overall_score"] for e in data["enterprises"]]}]}} if data["enterprises"] else None
        else:
            try:
                warnings = await assessment.get_all_warnings(db)
            except Exception:
                from app.services.mock_data import get_mock_warnings
                warnings = get_mock_warnings()
            data = {
                "warnings": [
                    {
                        **w,
                        "signal_labels": [
                            llm_reply.WARNING_LABELS.get(s, s) for s in w["warning_signals"]
                        ],
                    }
                    for w in warnings
                ]
            }
            charts = {"type": "warnings", "data": data["warnings"]}

    elif intent == "full_report":
        eid, ent = await _resolve_single_enterprise(db, intent_result.enterprises)
        if not ent:
            msg = _unknown_enterprise_message() if intent_result.enterprises else _missing_enterprise_message("full_report")
            data = {"message": msg}
        else:
            try:
                report_id, _ = await report_generator.generate_report(db, eid)
            except Exception:
                # Mock report generation when DB unavailable
                import uuid
                from app.services.mock_data import get_mock_enterprise
                mock_ent = get_mock_enterprise(eid)
                if mock_ent:
                    report_id = f"mock-{uuid.uuid4().hex[:8]}"
                    data = {
                        "enterprise_id": eid,
                        "enterprise_name": mock_ent["enterprise_name"],
                        "report_id": report_id,
                        "download_url": f"/api/v1/report/{report_id}/download",
                        "source": "mock",
                        "note": "模拟数据报告，真实数据导入后将自动替换",
                    }
                    reply = await llm_reply.generate_reply(query, intent, data)
                    session_store.store_session(sid, intent, [eid], query, [mock_ent.get("enterprise_name", "")])
                    return {"reply": reply, "intent": intent, "data": data, "charts": None, "session_id": sid}
                data = {"message": "报告生成失败，请稍后重试"}
                reply = await llm_reply.generate_reply(query, intent, data)
                return {"reply": reply, "intent": intent, "data": data, "charts": None, "session_id": sid}
            data = {
                "enterprise_id": eid,
                "enterprise_name": ent["enterprise_name"],
                "report_id": report_id,
                "download_url": f"/api/v1/report/{report_id}/download",
            }

    elif intent == "email_report":
        eid, ent = await _resolve_single_enterprise(db, intent_result.enterprises)
        recipient = intent_result.recipient
        if not ent:
            msg = _unknown_enterprise_message() if intent_result.enterprises else _missing_enterprise_message("email_report")
            data = {"message": msg}
        elif not recipient:
            data = {"message": "已识别到企业，请在问题中包含收件邮箱，例如：发送报告到 user@example.com"}
        elif not email_service.is_configured():
            data = {"success": False, "message": email_service.NOT_CONFIGURED_MSG}
        else:
            _, pdf_path = await report_generator.generate_report(db, eid)
            email_service.send_report(recipient, ent["enterprise_name"], pdf_path)
            data = {"success": True, "recipient": recipient, "enterprise_name": ent["enterprise_name"]}

    else:
        eid, ent = await _resolve_single_enterprise(db, intent_result.enterprises)
        if ent:
            data = {
                "enterprise": {
                    "enterprise_id": ent["enterprise_id"],
                    "enterprise_name": ent["enterprise_name"],
                    "overall_score": ent["overall_score"],
                    "risk_level": ent["risk_level"],
                    "tax_health": ent["dimensions"]["tax_health"],
                    "authenticity": ent["dimensions"]["authenticity"],
                    "industry": ent["dimensions"]["industry"],
                    "legal": ent["dimensions"]["legal"],
                    "finance": ent["dimensions"]["finance"],
                }
            }
            charts = _radar_chart(ent)
            intent = "general"
        else:
            data = {"hint": "可提问：税务健康、行业排名、企业对比、风险预警、生成报告等"}

    reply = await llm_reply.generate_reply(query, intent, data)
    if not (reply or "").strip():
        reply = llm_reply._template_reply(intent, data, with_prefix=True)
    logger.info("route_chat reply[:200]=%r", reply[:200])

    enterprises_to_store = list(intent_result.enterprises)
    names_to_store = list(intent_result.enterprise_names)
    if not enterprises_to_store:
        ent = data.get("enterprise") or {}
        if ent.get("enterprise_id"):
            enterprises_to_store = [ent["enterprise_id"]]
            names_to_store = [ent.get("enterprise_name", "")]
    session_store.store_session(
        sid,
        intent,
        enterprises_to_store,
        query,
        names_to_store or None,
    )

    return {
        "reply": reply,
        "intent": intent,
        "data": data,
        "charts": charts,
        "session_id": sid,
    }
