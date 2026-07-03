"""
开源验证基准：FinRobot 多Agent金融分析架构
GitHub: AI4Finance-Foundation/FinRobot
论文：FinRobot: AI Agent for Equity Research (2024)

3-Agent架构（FinRobot核心）：
  Data-CoT Agent   → 数据收集 + 指标计算
  Concept-CoT Agent → 行业对标 + 估值分析
  Thesis-CoT Agent → 报告撰写 + 结论生成

我们的三维引擎对应关系：
  Data-CoT    → assessment.py 的 calculate()
  Concept-CoT → industry_compare + enterprise_pk
  Thesis-CoT  → report_generator.py

Cursor验证任务：
  对比FinRobot的评分维度权重 vs 我们的三维权重
  对比FinRobot的报告结构 vs 我们的PDF报告
"""

# FinRobot核心评估框架（简化版，用于交叉验证）
FINROBOT_DIMENSIONS = {
    "financial_health": {
        "weight": 0.30,
        "indicators": ["roe", "revenue_growth", "debt_ratio", "current_ratio"],
        "method": "industry_percentile"  # 与我们一致
    },
    "business_quality": {
        "weight": 0.25,
        "indicators": ["revenue_stability", "customer_concentration", "rd_ratio"],
        "method": "industry_percentile"
    },
    "valuation_risk": {
        "weight": 0.20,
        "indicators": ["pe_ratio", "pb_ratio", "z_score"],
        "method": "absolute_threshold"
    },
    "governance_risk": {
        "weight": 0.15,
        "indicators": ["board_independence", "audit_quality", "compliance"],
        "method": "rule_based"
    },
    "market_sentiment": {
        "weight": 0.10,
        "indicators": ["price_momentum", "analyst_rating", "news_sentiment"],
        "method": "quantile"
    }
}

# FinRobot报告结构（对比我们的六章结构）
FINROBOT_REPORT_SECTIONS = [
    "1. Executive Summary",        # → 我们的一章：评估摘要
    "2. Company Overview",         # → 我们的第一章含企业基本信息
    "3. Financial Analysis",       # → 我们的税务健康+经营真实性
    "4. Industry Positioning",     # → 我们的行业对标
    "5. Risk Assessment",          # → 我们的预警信号
    "6. Valuation & Outlook",      # → 我们的财务预警
    "7. Appendix: Data Sources",   # → 我们的数据说明
]

# 验证用：对比我们的权重配置与FinRobot的差异
OUR_WEIGHTS = {
    "tax_health": 0.40,
    "authenticity": 0.35,
    "finance": 0.25,
}
