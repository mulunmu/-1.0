# 五维评估权重：税务25 / 经营25 / 行业20 / 法律15 / 财务15

DIMENSION_WEIGHTS: dict[str, float] = {
    "tax_health": 0.25,
    "authenticity": 0.25,
    "industry": 0.20,
    "legal": 0.15,
    "finance": 0.15,
}

DIMENSION_LABELS: dict[str, str] = {
    "tax_health": "税务健康",
    "authenticity": "经营真实性",
    "industry": "行业地位",
    "legal": "法律合规",
    "finance": "财务健康",
}

FINROBOT_REPORT_SECTIONS = [
    "Executive Summary",
    "Company Overview",
    "Financial Analysis",
    "Industry Positioning",
    "Risk Assessment",
    "Valuation & Outlook",
    "Appendix: Data Sources",
]
