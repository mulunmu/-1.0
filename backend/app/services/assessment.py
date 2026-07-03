from decimal import Decimal
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core_metrics import CoreMetrics
from app.services.assessment_weights import DIMENSION_WEIGHTS

_CACHE: dict = {"metrics": [], "loaded_at": None}

SOCIAL_TREND_SCORE = {"增长": 100, "稳定": 70, "缩减": 30}
Z_SCORE_LEVEL = {"安全": 80, "灰色": 50, "困境": 20}
RISK_LEVELS = [
    (80, "低风险"),
    (65, "中低风险"),
    (50, "中等风险"),
    (35, "中高风险"),
    (0, "高风险"),
]


async def _ensure_cache(db: AsyncSession) -> list[CoreMetrics]:
    if not _CACHE["metrics"]:
        result = await db.execute(select(CoreMetrics))
        _CACHE["metrics"] = list(result.scalars().all())
        _CACHE["loaded_at"] = time.time()
    return _CACHE["metrics"]


async def refresh_cache(db: AsyncSession) -> None:
    result = await db.execute(select(CoreMetrics))
    _CACHE["metrics"] = list(result.scalars().all())
    _CACHE["loaded_at"] = time.time()


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


def _calc_tax_health(m: CoreMetrics) -> float:
    dishonesty = 25 if m.is_dishonesty else 0
    execution = 25 if m.is_execution else 0
    result = (
        _to_float(m.credit_score) * 0.4
        + _to_float(m.tax_on_time_rate) * 100 * 0.3
        - m.tax_arrears_cnt * 10
        - m.tax_violation_cnt * 15
        - m.high_severity_cnt * 20
        - dishonesty
        - execution
    )
    return max(-50, result)


def _calc_authenticity(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    invoices = [_to_float(x.invoice_monthly_avg) for x in all_metrics]
    inv_pct = _percentile(_to_float(m.invoice_monthly_avg), invoices)
    social = SOCIAL_TREND_SCORE.get(m.social_trend, 70)
    dev_score = (1 - abs(_to_float(m.revenue_deviation))) * 100 * 0.5
    score = dev_score + inv_pct * 0.3 + social * 0.2
    return {
        "score": score,
        "revenue_deviation_component": dev_score,
        "invoice_percentile": inv_pct,
        "social_trend_score": social,
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
    return {
        "score": score,
        "roe_percentile": roe_pct,
        "revenue_yoy_percentile": yoy_pct,
        "debt_ratio_reverse_percentile": debt_rev_pct,
        "z_score_level_score": z_score,
    }


def _warning_signals(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> list[str]:
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
    return signals


def _build_result(m: CoreMetrics, all_metrics: list[CoreMetrics]) -> dict:
    tax = _calc_tax_health(m)
    auth = _calc_authenticity(m, all_metrics)
    fin = _calc_finance(m, all_metrics)
    overall = (
        tax * DIMENSION_WEIGHTS["tax_health"]
        + auth["score"] * DIMENSION_WEIGHTS["authenticity"]
        + fin["score"] * DIMENSION_WEIGHTS["finance"]
    )
    return {
        "enterprise_id": m.enterprise_id,
        "enterprise_name": m.enterprise_name,
        "credit_level": m.credit_level,
        "tax_on_time_rate": round(_to_float(m.tax_on_time_rate), 4),
        "invoice_monthly_avg": m.invoice_monthly_avg,
        "revenue_deviation": round(_to_float(m.revenue_deviation), 4),
        "social_trend": m.social_trend,
        "overall_score": round(overall, 2),
        "risk_level": _risk_level(overall),
        "dimensions": {
            "tax_health": round(tax, 2),
            "authenticity": round(auth["score"], 2),
            "finance": round(fin["score"], 2),
        },
        "dimension_details": {
            "tax_health": {"score": round(tax, 2), "weight": DIMENSION_WEIGHTS["tax_health"]},
            "authenticity": {
                "score": round(auth["score"], 2),
                "weight": DIMENSION_WEIGHTS["authenticity"],
                **{k: round(v, 2) if isinstance(v, float) else v for k, v in auth.items() if k != "score"},
            },
            "finance": {
                "score": round(fin["score"], 2),
                "weight": DIMENSION_WEIGHTS["finance"],
                **{k: round(v, 2) if isinstance(v, float) else v for k, v in fin.items() if k != "score"},
            },
        },
        "warning_signals": _warning_signals(m, all_metrics),
    }


async def calculate(db: AsyncSession, enterprise_id: str) -> dict | None:
    all_metrics = await _ensure_cache(db)
    target = next((m for m in all_metrics if m.enterprise_id == enterprise_id), None)
    if not target:
        return None
    return _build_result(target, all_metrics)


async def calculate_dimensions(db: AsyncSession, enterprise_id: str) -> dict | None:
    result = await calculate(db, enterprise_id)
    if not result:
        return None
    return {
        "enterprise_id": result["enterprise_id"],
        "dimensions": result["dimension_details"],
        "overall_score": result["overall_score"],
        "risk_level": result["risk_level"],
    }


async def calculate_pk(db: AsyncSession, enterprise_ids: list[str]) -> list[dict]:
    all_metrics = await _ensure_cache(db)
    by_id = {m.enterprise_id: m for m in all_metrics}
    return [
        _build_result(by_id[eid], all_metrics)
        for eid in enterprise_ids
        if eid in by_id
    ]


async def get_all_warnings(db: AsyncSession) -> list[dict]:
    all_metrics = await _ensure_cache(db)
    items = []
    for m in all_metrics:
        built = _build_result(m, all_metrics)
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
