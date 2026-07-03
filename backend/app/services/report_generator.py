"""企业评估报告 PDF 生成（WeasyPrint 优先，fpdf2 备选）"""
from __future__ import annotations

import logging
from datetime import datetime
from io import BytesIO, StringIO
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core_metrics import CoreMetrics
from app.services import assessment
from app.services.assessment_weights import DIMENSION_WEIGHTS

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(__file__).resolve().parents[2] / "reports"
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"

WARNING_LABELS: dict[str, tuple[str, str]] = {
    "tax_on_time_rate_low": ("纳税准时率低于 80%", "red"),
    "invoice_monthly_avg_drop": ("发票月均下降超过 50%", "yellow"),
    "credit_level_risk": ("信用等级 C/D/M", "red"),
    "social_trend_shrink": ("社保参保趋势缩减", "yellow"),
    "revenue_deviation_high": ("营收偏差超过 30%", "red"),
}

RISK_STYLE: dict[str, tuple[str, str]] = {
    "低风险": ("#059669", "#ecfdf5"),
    "中低风险": ("#2563eb", "#eff6ff"),
    "中等风险": ("#d97706", "#fffbeb"),
    "中高风险": ("#dc2626", "#fef2f2"),
    "高风险": ("#991b1b", "#fef2f2"),
}

RISK_TIPS: dict[str, str] = {
    "低风险": "企业整体风险可控，税务合规性和经营真实性表现良好。建议维持现有经营策略，定期关注行业政策变化。",
    "中低风险": "企业风险处于可接受范围，部分指标有优化空间。建议加强税务申报管理，持续监控发票与营收匹配度。",
    "中等风险": "企业存在一定风险隐患，需重点关注预警信号。建议开展专项税务自查，优化社保参保和财务结构。",
    "中高风险": "企业多项指标偏离正常区间，风险较高。建议立即排查税务欠缴和司法诉讼情况，制定风险整改计划。",
    "高风险": "企业综合风险评级较高，存在多项严重预警信号。建议启动全面风险评估，必要时寻求专业法律和财务顾问支持。",
}

DIMENSION_META = [
    ("tax_health", "税务健康", f"{int(DIMENSION_WEIGHTS['tax_health'] * 100)}%"),
    ("authenticity", "经营真实性", f"{int(DIMENSION_WEIGHTS['authenticity'] * 100)}%"),
    ("finance", "行业财务", f"{int(DIMENSION_WEIGHTS['finance'] * 100)}%"),
]


def _setup_matplotlib_font() -> None:
    plt.rcParams["font.sans-serif"] = [
        "Microsoft YaHei",
        "SimHei",
        "PingFang SC",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False


def _create_radar_figure(
    enterprise_dims: dict[str, float],
    industry_avg: dict[str, float],
):
    _setup_matplotlib_font()
    labels = [m[1] for m in DIMENSION_META]
    keys = [m[0] for m in DIMENSION_META]
    ent_vals = [enterprise_dims[k] for k in keys]
    avg_vals = [industry_avg[k] for k in keys]

    angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist()
    angles_closed = angles + angles[:1]
    ent_closed = ent_vals + ent_vals[:1]
    avg_closed = avg_vals + avg_vals[:1]

    fig, ax = plt.subplots(figsize=(5.5, 5.5), subplot_kw={"polar": True})
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_thetagrids(np.degrees(angles), labels, fontsize=10)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=7, color="#94a3b8")
    ax.grid(color="#cbd5e1", linestyle="--", alpha=0.6)

    ax.plot(angles_closed, ent_closed, "o-", linewidth=2, color="#3b82f6", label="本企业")
    ax.fill(angles_closed, ent_closed, alpha=0.2, color="#3b82f6")
    ax.plot(
        angles_closed,
        avg_closed,
        "o--",
        linewidth=1.5,
        color="#94a3b8",
        label="行业均值",
    )
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.1), fontsize=9)
    fig.tight_layout()
    return fig


def create_radar_svg(
    enterprise_dims: dict[str, float],
    industry_avg: dict[str, float],
) -> str:
    fig = _create_radar_figure(enterprise_dims, industry_avg)
    buf = StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()


def create_radar_png_bytes(
    enterprise_dims: dict[str, float],
    industry_avg: dict[str, float],
) -> BytesIO:
    fig = _create_radar_figure(enterprise_dims, industry_avg)
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


async def _load_context(db: AsyncSession, enterprise_id: str) -> dict:
    enterprise = await assessment.calculate(db, enterprise_id)
    if not enterprise:
        raise ValueError("企业不存在")

    dimensions = await assessment.calculate_dimensions(db, enterprise_id)
    row = await db.get(CoreMetrics, enterprise_id)
    result = await db.execute(select(CoreMetrics.enterprise_id))
    all_ids = [row[0] for row in result.all()]
    all_scores = await assessment.calculate_pk(db, all_ids)
    n = max(len(all_scores), 1)

    industry_avg = {
        "tax_health": sum(s["dimensions"]["tax_health"] for s in all_scores) / n,
        "authenticity": sum(s["dimensions"]["authenticity"] for s in all_scores) / n,
        "finance": sum(s["dimensions"]["finance"] for s in all_scores) / n,
    }
    industry_overall = sum(s["overall_score"] for s in all_scores) / n
    ranking = sorted(all_scores, key=lambda x: x["overall_score"], reverse=True)
    industry_rank = next(
        (i + 1 for i, s in enumerate(ranking) if s["enterprise_id"] == enterprise_id),
        None,
    )
    if row:
        ind_rows = await db.execute(
            select(CoreMetrics).where(CoreMetrics.industry_l1 == row.industry_l1)
        )
        same_ids = {m.enterprise_id for m in ind_rows.scalars().all()}
        peer_scores = sorted(
            [s for s in all_scores if s["enterprise_id"] in same_ids],
            key=lambda x: x["overall_score"],
            reverse=True,
        )
        industry_peer_rank = next(
            (i + 1 for i, s in enumerate(peer_scores) if s["enterprise_id"] == enterprise_id),
            None,
        )
        industry_peer_total = len(peer_scores)
    else:
        industry_peer_rank = industry_rank
        industry_peer_total = len(all_scores)

    risk_color, risk_bg = RISK_STYLE.get(enterprise["risk_level"], ("#64748b", "#f1f5f9"))
    report_date = datetime.now().strftime("%Y年%m月%d日")

    dimension_rows = [
        {
            "name": name,
            "weight": weight,
            "score": f"{enterprise['dimensions'][key]:.1f}",
            "industry_avg": f"{industry_avg[key]:.1f}",
        }
        for key, name, weight in DIMENSION_META
    ]

    warnings = []
    for sig in enterprise.get("warning_signals", []):
        label, severity = WARNING_LABELS.get(sig, (sig, "yellow"))
        warnings.append({"label": label, "severity": severity})

    return {
        "enterprise_id": enterprise["enterprise_id"],
        "enterprise_name": enterprise["enterprise_name"],
        "overall_score": f"{enterprise['overall_score']:.1f}",
        "risk_level": enterprise["risk_level"],
        "risk_color": risk_color,
        "risk_bg": risk_bg,
        "report_date": report_date,
        # Reference: FinRobot Section 2 - Company Overview
        "company_overview": {
            "industry_l1": row.industry_l1 if row else "-",
            "industry_l2": row.industry_l2 if row else "-",
            "province": row.province if row else "-",
            "city": row.city if row else "-",
        },
        "executive_summary": (
            f"{enterprise['enterprise_name']}综合评分{enterprise['overall_score']:.1f}分，"
            f"风险等级{enterprise['risk_level']}，"
            f"样本排名第{industry_rank}/{len(all_scores)}。"
        ),
        # Reference: FinRobot Section 4 - Industry Positioning
        "industry_positioning": (
            f"所属行业「{row.industry_l1 if row else '-'}」，"
            f"同行业排名 {industry_peer_rank}/{industry_peer_total}，"
            f"样本综合均值 {industry_overall:.1f} 分。"
        ),
        # Reference: FinRobot Section 6 - Valuation & Outlook
        "valuation_outlook": {
            "pe_ratio": f"{float(row.pe_ratio):.2f}" if row else "-",
            "revenue_yoy": f"{float(row.revenue_yoy) * 100:.2f}%" if row else "-",
            "z_score_level": row.z_score_level if row else "-",
            "outlook": RISK_TIPS.get(enterprise["risk_level"], "请关注指标变化。"),
        },
        "dimension_rows": dimension_rows,
        "industry_overall_avg": f"{industry_overall:.1f}",
        "key_metrics": [
            {"label": "信用等级", "value": enterprise["credit_level"]},
            {"label": "纳税稳定性", "value": f"{enterprise['tax_on_time_rate'] * 100:.1f}%"},
            {"label": "发票月均", "value": f"{enterprise['invoice_monthly_avg']:,}"},
            {"label": "营收偏差", "value": f"{enterprise['revenue_deviation'] * 100:.2f}%"},
            {"label": "社保趋势", "value": enterprise["social_trend"]},
        ],
        "warnings": warnings,
        "risk_tips": RISK_TIPS.get(enterprise["risk_level"], "请关注企业风险指标变化。"),
        "radar_svg": create_radar_svg(enterprise["dimensions"], industry_avg),
        "dimensions_detail": dimensions,
        "_enterprise_dims": enterprise["dimensions"],
        "_industry_avg": industry_avg,
    }


def _render_html(context: dict, report_id: str) -> str:
    ctx = {**context, "report_id": report_id}
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("report.html")
    return template.render(**ctx)


def _generate_with_weasyprint(html: str, output_path: Path) -> bool:
    try:
        from weasyprint import HTML

        HTML(string=html).write_pdf(str(output_path))
        return True
    except Exception as exc:
        logger.warning("WeasyPrint 不可用，切换 fpdf2: %s", exc)
        return False


def _find_chinese_font() -> Path | None:
    candidates = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path(r"C:\Windows\Fonts\simsun.ttc"),
        Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
        Path("/System/Library/Fonts/PingFang.ttc"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def _generate_with_fpdf2(context: dict, report_id: str, output_path: Path) -> None:
    from fpdf import FPDF

    pdf = FPDF()
    font_path = _find_chinese_font()
    if font_path:
        pdf.add_font("CN", "", str(font_path))
        pdf.set_font("CN", size=11)
    else:
        pdf.set_font("Helvetica", size=11)

    fn = "CN" if font_path else "Helvetica"
    ent_name = context["enterprise_name"]
    radar_buf = create_radar_png_bytes(context["_enterprise_dims"], context["_industry_avg"])

    # 第1页：封面
    pdf.add_page()
    pdf.set_font(fn, size=11)
    pdf.cell(0, 10, "企业风险评估报告", ln=True, align="C")
    pdf.ln(20)
    pdf.set_font(fn, size=22)
    pdf.cell(0, 14, ent_name, ln=True, align="C")
    pdf.set_font(fn, size=11)
    pdf.cell(0, 8, f"企业编号：{context['enterprise_id']}", ln=True, align="C")
    pdf.cell(0, 8, f"评估日期：{context['report_date']}", ln=True, align="C")
    pdf.cell(0, 8, f"报告编号：{report_id}", ln=True, align="C")
    pdf.ln(16)
    pdf.set_font(fn, size=36)
    pdf.cell(0, 16, context["overall_score"], ln=True, align="C")
    pdf.set_font(fn, size=16)
    pdf.cell(0, 10, context["risk_level"], ln=True, align="C")

    # 第2页：评分详情
    pdf.add_page()
    pdf.set_font(fn, size=14)
    pdf.cell(0, 10, "三维评分详情", ln=True)
    pdf.ln(4)
    pdf.image(radar_buf, x=30, w=150)
    pdf.ln(4)
    pdf.set_font(fn, size=11)
    for row in context["dimension_rows"]:
        pdf.cell(
            0,
            8,
            f"{row['name']}  权重{row['weight']}  得分{row['score']}  行业均值{row['industry_avg']}",
            ln=True,
        )
    pdf.ln(6)
    pdf.cell(0, 8, "关键指标", ln=True)
    for m in context["key_metrics"]:
        pdf.cell(0, 7, f"  {m['label']}：{m['value']}", ln=True)

    # 第3页：预警
    pdf.add_page()
    pdf.set_font(fn, size=14)
    pdf.cell(0, 10, "预警信号清单", ln=True)
    pdf.set_font(fn, size=11)
    if context["warnings"]:
        for w in context["warnings"]:
            pdf.cell(0, 8, f"  [!] {w['label']}", ln=True)
    else:
        pdf.cell(0, 8, "  当前无预警信号", ln=True)
    pdf.ln(8)
    pdf.set_font(fn, size=14)
    pdf.cell(0, 10, "风险提示与建议", ln=True)
    pdf.set_font(fn, size=11)
    pdf.multi_cell(0, 7, context["risk_tips"])
    pdf.ln(6)
    pdf.set_font(fn, size=14)
    pdf.cell(0, 10, "数据来源说明", ln=True)
    pdf.set_font(fn, size=10)
    sources = [
        "税务数据：税务局公开数据、企业申报记录",
        "工商信息：国家企业信用信息公示系统",
        "司法诉讼：中国裁判文书网、企查查",
        "财务指标：上市公司公告、行业数据库",
        "社保趋势：人社部门统计数据",
    ]
    for s in sources:
        pdf.cell(0, 7, f"  {s}", ln=True)
    pdf.ln(8)
    pdf.set_font(fn, size=9)
    pdf.multi_cell(
        0,
        6,
        f"本报告由企业风险评估系统自动生成，仅供参考。报告数据截至 {context['report_date']}。",
    )

    pdf.output(str(output_path))


async def generate_report(
    db: AsyncSession, enterprise_id: str
) -> tuple[str, Path]:
    """生成 PDF 报告，返回 (report_id, pdf_path)"""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_id = f"{enterprise_id}_{ts}"
    output_path = REPORTS_DIR / f"{report_id}.pdf"

    context = await _load_context(db, enterprise_id)
    html = _render_html(context, report_id)

    if not _generate_with_weasyprint(html, output_path):
        _generate_with_fpdf2(context, report_id, output_path)

    return report_id, output_path


def get_report_path(report_id: str) -> Path | None:
    path = REPORTS_DIR / f"{report_id}.pdf"
    return path if path.exists() else None
