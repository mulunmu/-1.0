"""法律合规维度 — 基于 legal_events + core_metrics 标志位"""
from __future__ import annotations

from app.models.core_metrics import CoreMetrics, LegalEvent

EVENT_LABELS: dict[str, str] = {
    "tax_violation": "税务违法",
    "tax_arrears": "欠税",
    "dishonesty": "失信",
    "execution": "被执行",
    "civil_lawsuit": "民事诉讼",
    "admin_penalty": "行政处罚",
}

# 法律风险分：100 起评，按事件类型扣分
EVENT_DEDUCTIONS: dict[str, float] = {
    "dishonesty": 30,
    "execution": 20,
    "tax_violation": 15,
    "tax_arrears": 10,
    "civil_lawsuit": 5,
    "admin_penalty": 10,
}

FLAG_DEDUCTIONS: dict[str, tuple[str, float]] = {
    "is_dishonesty": ("失信记录(标志)", 30),
    "is_execution": ("被执行(标志)", 20),
}


def calc_legal_score(metrics: CoreMetrics, events: list[LegalEvent] | None = None) -> dict:
    """计算法律合规分 0-100，并返回归因子项"""
    events = events or []
    score = 100.0
    negative: list[dict] = []
    positive: list[dict] = []

    type_counts: dict[str, int] = {}
    for ev in events:
        et = ev.event_type
        type_counts[et] = type_counts.get(et, 0) + 1

    for et, cnt in type_counts.items():
        deduct = EVENT_DEDUCTIONS.get(et, 5) * cnt
        score -= deduct
        negative.append(
            {
                "item": EVENT_LABELS.get(et, et),
                "deduction": round(deduct, 2),
                "count": cnt,
            }
        )

    if metrics.is_dishonesty and type_counts.get("dishonesty", 0) == 0:
        score -= FLAG_DEDUCTIONS["is_dishonesty"][1]
        negative.append(
            {"item": FLAG_DEDUCTIONS["is_dishonesty"][0], "deduction": 30, "count": 1}
        )
    if metrics.is_execution and type_counts.get("execution", 0) == 0:
        score -= FLAG_DEDUCTIONS["is_execution"][1]
        negative.append(
            {"item": FLAG_DEDUCTIONS["is_execution"][0], "deduction": 20, "count": 1}
        )

    score = max(0.0, min(100.0, score))

    if not negative:
        positive.append({"item": "无重大法律事件", "contribution": round(score, 2)})
    elif score >= 60:
        positive.append({"item": "法律风险整体可控", "contribution": round(score * 0.3, 2)})

    return {
        "score": round(score, 2),
        "event_count": len(events),
        "positive": positive,
        "negative": negative,
    }
