# Reference: FinRobot Section 3.2 - FINROBOT_DIMENSIONS 映射至三维评估模型
# FinRobot 五维: financial_health 0.30, business_quality 0.25, valuation_risk 0.20,
#               governance_risk 0.15, market_sentiment 0.10
# 映射规则: tax_health≈governance, authenticity≈business_quality,
#           finance≈financial_health+valuation_risk+market_sentiment
# 原权重 tax_health 0.40 / authenticity 0.35 / finance 0.25 与 FinRobot 偏差 >10%，已调整

DIMENSION_WEIGHTS: dict[str, float] = {
    "tax_health": 0.30,
    "authenticity": 0.30,
    "finance": 0.40,
}

# FinRobot 报告七章结构对照（用于 report_generator 章节校验）
FINROBOT_REPORT_SECTIONS = [
    "Executive Summary",
    "Company Overview",
    "Financial Analysis",
    "Industry Positioning",
    "Risk Assessment",
    "Valuation & Outlook",
    "Appendix: Data Sources",
]
