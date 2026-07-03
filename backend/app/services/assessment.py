from decimal import Decimal
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core_metrics import CoreMetrics, LegalEvent
from app.services.assessment_weights import DIMENSION_LABELS, DIMENSION_WEIGHTS
from app.services import legal_service

_CACHE: dict = {"metrics": [], "legal_by_ent": {}, "loaded_at": None}

SOCIAL_TREND_SCORE = {"增长": 100, "稳定": 70, "缩减": 30}
Z_SCORE_LEVEL = {"安全": 80, "灰色": 50, "困境": 20}
RISK_LEVELS = [
    (80, "低风险"),
    (65, "中低风险"),
    (50, "中等风险"),
    (35, "中高风险"),
    (0, "高风险"),
]
NO_BENCHMARK_INDUSTRIES = {"非上市", "其他"}


async def _ensure_cache(db: AsyncSession) -> list[CoreMetrics]:
    if not _CACHE["metrics"]:
        result = await db.execute(select(CoreMetrics))
        _CACHE["metrics"] = list(result.scalars().all())
        ev_result = await db.execute(select(LegalEvent))
        events = list(ev_result.scalars().all())
        by_ent: dict[str, list[LegalEvent]] = {}
        for ev in events:
            by_ent.setdefault(ev.enterprise_id, []).append(ev)
        _CACHE["legal_by_ent"] = by_ent
        _CACHE["loaded_at"] = time.time()
    return _CACHE["metrics"]


async def refresh_cache(db: AsyncSession) -> None:
    _CACHE["metrics"] = []
    _CACHE["legal_by_ent"] = {}
    await _ensure_cache(db)


def _percentile(value: float, population: list[float]) -> float:
    if not population:
        return 50.0
    if len(population) == 1:
        return 50.0
    rank = sum(1 for v in population if v <= value)
    return (rank - 1) / (len(population) - 1) * 100


def _to_float(v: Decimal | int | float) -> float:
    return float(v)


def _risk_level(score: float) -> str:
    for threshold, label in RISK_LEVELS:
        if score >= threshold:
            return label
    return "高风险"


def _calc_tax_health(m: CoreMetrics) -> tuple[float, list[dict], list[dict]]:
    positive: list[dict] = []
    negative: list[dict] = []
    credit_contrib = _to_float(m.credit_score) * 0.4
    positive.append({"item": "纳税信用", "contribution": round(credit_contrib, 2)})
    tax_rate_contrib = _to_float(m.tax_on_time_rate) * 100 * 0.3
    positive.append({"item": "纳税准时率", "contribution": round(tax_rate_contrib, 2)})

    if m.tax_arrears_cnt:
        d = m.tax_arrears_cnt * 10
        negative.append({"item": "欠税记录", "deduction": d, "count": m.tax_arrears_cnt})
    if m.tax_violation_cnt:
        d = m.tax_violation_cnt * 15
        negative.append({"item": "税务违法", "deduction": d, "count": m.tax_violation_cnt})
    if m.high_severity_cnt:
        d = m.high_severity_cnt * 20
        negative.append({"item": "高危事件", "deduction": d, "count": m.high_severity_cnt})
    if m.is_dishonesty:
        negative.append({"item": "失信标志", "deduction": 25, "count": 1})
    if m.is_execution:
        negative.append({"item": "被执行标志", "deduction": 25, "count": 1})

    deduct = sum(n["deduction"] for n in negative)
    result = credit_contrib + tax_rate_contrib - deduct
    return max(-50, result), positive, negative


def _calc_authenticity(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    invoices = [_to_float(x.invoice_monthly_avg) for x in all_metrics]
    inv_pct = _percentile(_to_float(m.invoice_monthly_avg), invoices)
    social = SOCIAL_TREND_SCORE.get(m.social_trend, 70)
    dev_score = (1 - abs(_to_float(m.revenue_deviation))) * 100 * 0.5
    score = dev_score + inv_pct * 0.3 + social * 0.2

    positive = [
        {"item": "营收偏差匹配", "contribution": round(dev_score, 2)},
        {"item": "发票活跃度", "contribution": round(inv_pct * 0.3, 2)},
        {"item": "社保趋势", "contribution": round(social * 0.2, 2)},
    ]
    negative: list[dict] = []
    if _to_float(m.revenue_deviation) > 0.3:
        negative.append({"item": "营收偏差过大", "deduction": round((_to_float(m.revenue_deviation) - 0.3) * 100, 2)})
    if m.social_trend == "缩减":
        negative.append({"item": "社保趋势缩减", "deduction": 15})
    medians = sorted(invoices)
    median_inv = medians[len(medians) // 2] if medians else 0
    if median_inv > 0 and _to_float(m.invoice_monthly_avg) < median_inv * 0.5:
        negative.append({"item": "发票月均骤降", "deduction": 20})

    return {
        "score": score,
        "positive": positive,
        "negative": negative,
        "revenue_deviation_component": dev_score,
        "invoice_percentile": inv_pct,
        "social_trend_score": social,
    }


def _calc_industry(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    if m.industry_l1 in NO_BENCHMARK_INDUSTRIES:
        return {
            "score": 50.0,
            "positive": [{"item": "无行业对标样本", "contribution": 50}],
            "negative": [],
            "peer_rank": None,
            "peer_total": 0,
            "note": "非上市/无对标",
        }
    if m.industry_l2 == "新注册":
        return {
            "score": 40.0,
            "positive": [],
            "negative": [{"item": "经营数据不足12个月", "deduction": 10}],
            "peer_rank": None,
            "peer_total": 0,
            "note": "新注册企业",
        }

    peers = [
        x for x in all_metrics
        if x.industry_l1 == m.industry_l1 and x.industry_l1 not in NO_BENCHMARK_INDUSTRIES
    ]
    if len(peers) <= 1:
        return {
            "score": 50.0,
            "positive": [{"item": "同行业样本不足", "contribution": 50}],
            "negative": [],
            "peer_rank": 1,
            "peer_total": 1,
        }

    peer_roes = [_to_float(x.roe) for x in peers]
    peer_yoys = [_to_float(x.revenue_yoy) for x in peers]
    roe_pct = _percentile(_to_float(m.roe), peer_roes)
    yoy_pct = _percentile(_to_float(m.revenue_yoy), peer_yoys)
    score = roe_pct * 0.5 + yoy_pct * 0.5

    ranking = sorted(
        peers,
        key=lambda x: _to_float(x.roe) + _to_float(x.revenue_yoy),
        reverse=True,
    )
    peer_rank = next(i + 1 for i, x in enumerate(ranking) if x.enterprise_id == m.enterprise_id)

    positive = [
        {"item": "ROE行业分位", "contribution": round(roe_pct * 0.5, 2)},
        {"item": "营收增速分位", "contribution": round(yoy_pct * 0.5, 2)},
    ]
    negative: list[dict] = []
    if peer_rank > len(peers) * 0.7:
        negative.append({"item": "同行业排名靠后", "deduction": 10})

    return {
        "score": score,
        "positive": positive,
        "negative": negative,
        "peer_rank": peer_rank,
        "peer_total": len(peers),
        "roe_percentile": roe_pct,
        "revenue_yoy_percentile": yoy_pct,
    }


def _calc_finance(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    roes = [_to_float(x.roe) for x in all_metrics]
    yoys = [_to_float(x.revenue_yoy) for x in all_metrics]
    debts = [_to_float(x.debt_ratio) for x in all_metrics]
    roe_pct = _percentile(_to_float(m.roe), roes)
    yoy_pct = _percentile(_to_float(m.revenue_yoy), yoys)
    debt_rev_pct = 100 - _percentile(_to_float(m.debt_ratio), debts)
    z_score = Z_SCORE_LEVEL.get(m.z_score_level, 50)
    score = roe_pct * 0.3 + yoy_pct * 0.25 + debt_rev_pct * 0.2 + z_score * 0.25

    positive = [
        {"item": "ROE分位", "contribution": round(roe_pct * 0.3, 2)},
        {"item": "营收增速分位", "contribution": round(yoy_pct * 0.25, 2)},
        {"item": "负债率逆向分位", "contribution": round(debt_rev_pct * 0.2, 2)},
        {"item": "Z-Score等级", "contribution": round(z_score * 0.25, 2)},
    ]
    negative: list[dict] = []
    if _to_float(m.debt_ratio) > 0.85:
        negative.append({"item": "资产负债率过高", "deduction": 15})
    if m.z_score_level == "困境":
        negative.append({"item": "Z-Score困境", "deduction": 20})

    return {
        "score": score,
        "positive": positive,
        "negative": negative,
        "roe_percentile": roe_pct,
        "revenue_yoy_percentile": yoy_pct,
        "debt_ratio_reverse_percentile": debt_rev_pct,
        "z_score_level_score": z_score,
    }


def _warning_signals(m: CoreMetrics, all_metrics: list[CoreMetrics], legal_score: float) -> list[str]:
    signals: list[str] = []
    if _to_float(m.tax_on_time_rate) < 0.8:
        signals.append("tax_on_time_rate_low")
    medians = sorted(_to_float(x.invoice_monthly_avg) for x in all_metrics)
    median_inv = medians[len(medians) // 2] if medians else 0
    if median_inv > 0 and _to_float(m.invoice_monthly_avg) < median_inv * 0.5:
        signals.append("invoice_monthly_avg_drop")
    if m.credit_level in ("C", "D", "M"):
        signals.append("credit_level_risk")
    if m.social_trend == "缩减":
        signals.append("social_trend_shrink")
    if _to_float(m.revenue_deviation) > 0.3:
        signals.append("revenue_deviation_high")
    if legal_score < 50:
        signals.append("legal_compliance_risk")
    if m.is_dishonesty or m.is_execution:
        signals.append("legal_enforcement_risk")
    return signals


def _attribution_summary(
    m: CoreMetrics,
    dim_scores: dict[str, float],
    dim_attr: dict[str, dict],
    overall: float,
) -> str:
    """模板归因总结（后续可接 LLM）"""
    drag: list[str] = []
    for key, label in DIMENSION_LABELS.items():
        score = dim_scores.get(key, 50)
        if score < 45:
            negs = dim_attr.get(key, {}).get("negative", [])
            if negs:
                drag.append(f"{label}（{negs[0]['item']}）")
            else:
                drag.append(f"{label}偏低")
    if drag:
        return (
            f"{m.enterprise_name}综合评分{overall:.1f}分，"
            f"主要拖累因素：{'、'.join(drag[:3])}。"
            f"建议优先排查相关指标。"
        )
    strengths = [label for key, label in DIMENSION_LABELS.items() if dim_scores.get(key, 0) >= 70]
    if strengths:
        return (
            f"{m.enterprise_name}综合评分{overall:.1f}分，"
            f"{'、'.join(strengths[:2])}表现较好，整体风险可控。"
        )
    return (
        f"{m.enterprise_name}综合评分{overall:.1f}分，"
        f"各维度表现中等，建议持续关注核心指标变化。"
    )


def _build_dimension_details(tax: float, auth: dict, industry: dict, legal: dict, fin: dict) -> dict:
    def _extra(d: dict) -> dict:
        return {k: round(v, 2) if isinstance(v, float) else v for k, v in d.items() if k not in ("score", "positive", "negative")}

    return {
        "tax_health": {"score": round(tax, 2), "weight": DIMENSION_WEIGHTS["tax_health"], "label": DIMENSION_LABELS["tax_health"]},
        "authenticity": {"score": round(auth["score"], 2), "weight": DIMENSION_WEIGHTS["authenticity"], "label": DIMENSION_LABELS["authenticity"], **_extra(auth)},
        "industry": {"score": round(industry["score"], 2), "weight": DIMENSION_WEIGHTS["industry"], "label": DIMENSION_LABELS["industry"], **_extra(industry)},
        "legal": {"score": round(legal["score"], 2), "weight": DIMENSION_WEIGHTS["legal"], "label": DIMENSION_LABELS["legal"], "event_count": legal["event_count"]},
        "finance": {"score": round(fin["score"], 2), "weight": DIMENSION_WEIGHTS["finance"], "label": DIMENSION_LABELS["finance"], **_extra(fin)},
    }


def _build_result(
    m: CoreMetrics,
    all_metrics: list[CoreMetrics],
    legal_events: list[LegalEvent] | None = None,
) -> dict:
    tax, tax_pos, tax_neg = _calc_tax_health(m)
    auth = _calc_authenticity(m, all_metrics)
    industry = _calc_industry(m, all_metrics)
    legal = legal_service.calc_legal_score(m, legal_events or [])
    fin = _calc_finance(m, all_metrics)

    dim_scores = {
        "tax_health": tax,
        "authenticity": auth["score"],
        "industry": industry["score"],
        "legal": legal["score"],
        "finance": fin["score"],
    }

    overall = sum(dim_scores[k] * DIMENSION_WEIGHTS[k] for k in DIMENSION_WEIGHTS)

    dim_attr = {
        "tax_health": {"positive": tax_pos, "negative": tax_neg},
        "authenticity": {"positive": auth["positive"], "negative": auth["negative"]},
        "industry": {"positive": industry["positive"], "negative": industry["negative"]},
        "legal": {"positive": legal["positive"], "negative": legal["negative"]},
        "finance": {"positive": fin["positive"], "negative": fin["negative"]},
    }

    attribution = {
        "dimensions": {
            key: {
                "score": round(dim_scores[key], 2),
                "weight": DIMENSION_WEIGHTS[key],
                "label": DIMENSION_LABELS[key],
                "positive": dim_attr[key]["positive"],
                "negative": dim_attr[key]["negative"],
                "net_contribution": round(dim_scores[key] * DIMENSION_WEIGHTS[key], 2),
            }
            for key in DIMENSION_WEIGHTS
        },
        "summary": _attribution_summary(m, dim_scores, dim_attr, overall),
    }

    return {
        "enterprise_id": m.enterprise_id,
        "enterprise_name": m.enterprise_name,
        "credit_level": m.credit_level,
        "tax_on_time_rate": round(_to_float(m.tax_on_time_rate), 4),
        "invoice_monthly_avg": m.invoice_monthly_avg,
        "revenue_deviation": round(_to_float(m.revenue_deviation), 4),
        "social_trend": m.social_trend,
        "industry_l1": m.industry_l1,
        "industry_l2": m.industry_l2,
        "province": m.province,
        "city": m.city,
        "overall_score": round(overall, 2),
        "risk_level": _risk_level(overall),
        "dimensions": {k: round(v, 2) for k, v in dim_scores.items()},
        "dimension_details": _build_dimension_details(tax, auth, industry, legal, fin),
        "attribution": attribution,
        "warning_signals": _warning_signals(m, all_metrics, legal["score"]),
    }


def _build_from_cache(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    events = _CACHE.get("legal_by_ent", {}).get(m.enterprise_id, [])
    return _build_result(m, all_metrics, events)


async def calculate(db: AsyncSession, enterprise_id: str) -> dict | None:
    all_metrics = await _ensure_cache(db)
    target = next((m for m in all_metrics if m.enterprise_id == enterprise_id), None)
    if not target:
        return None
    return _build_from_cache(target, all_metrics)


async def calculate_dimensions(db: AsyncSession, enterprise_id: str) -> dict | None:
    result = await calculate(db, enterprise_id)
    if not result:
        return None
    return {
        "enterprise_id": result["enterprise_id"],
        "dimensions": result["dimension_details"],
        "attribution": result["attribution"],
        "overall_score": result["overall_score"],
        "risk_level": result["risk_level"],
    }


async def calculate_pk(db: AsyncSession, enterprise_ids: list[str]) -> list[dict]:
    all_metrics = await _ensure_cache(db)
    by_id = {m.enterprise_id: m for m in all_metrics}
    return [_build_from_cache(by_id[eid], all_metrics) for eid in enterprise_ids if eid in by_id]


async def list_all(db: AsyncSession) -> list[dict]:
    """返回全部企业评估摘要（供 Dashboard / 搜索）"""
    all_metrics = await _ensure_cache(db)
    results = [_build_from_cache(m, all_metrics) for m in all_metrics]
    initials_map = _load_registry_initials()
    for r in results:
        r["initials"] = initials_map.get(r["enterprise_id"], "")
    return results


def _load_registry_initials() -> dict[str, str]:
    from pathlib import Path
    import json

    path = Path(__file__).resolve().parent.parent / "data" / "companies_registry.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {item["id"]: item.get("initials", "") for item in data}
    except Exception:
        return {}


async def get_legal_events(db: AsyncSession, enterprise_id: str) -> list[dict]:
    await _ensure_cache(db)
    events = _CACHE.get("legal_by_ent", {}).get(enterprise_id, [])
    return [
        {
            "id": ev.id,
            "enterprise_id": ev.enterprise_id,
            "event_type": ev.event_type,
            "severity": ev.severity,
            "amount_involved": float(ev.amount_involved) if ev.amount_involved else 0,
            "event_date": ev.event_date.isoformat() if ev.event_date else None,
            "description": ev.description,
            "source": ev.source,
        }
        for ev in events
    ]


async def get_all_warnings(db: AsyncSession) -> list[dict]:
    all_metrics = await _ensure_cache(db)
    items = []
    for m in all_metrics:
        built = _build_from_cache(m, all_metrics)
        if built["warning_signals"]:
            items.append(
                {
                    "enterprise_id": built["enterprise_id"],
                    "enterprise_name": built["enterprise_name"],
                    "risk_level": built["risk_level"],
                    "overall_score": built["overall_score"],
                    "warning_signals": built["warning_signals"],
                }
            )
    return sorted(items, key=lambda x: x["overall_score"])
