"""LLM 回复生成（Reference: litellm 官方 fallback + num_retries 模式）"""
from __future__ import annotations

import json
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TEMPLATE_PREFIX = "[规则模板生成] "
LLM_NOT_CONFIGURED_MSG = TEMPLATE_PREFIX.strip()
FALLBACK_REPLY = TEMPLATE_PREFIX + "分析完成，请查看下方图表与数据详情。"

WARNING_LABELS = {
    "tax_on_time_rate_low": "纳税准时率低",
    "invoice_monthly_avg_drop": "发票月均大幅下降",
    "credit_level_risk": "信用等级风险",
    "social_trend_shrink": "社保趋势缩减",
    "revenue_deviation_high": "营收偏差过高",
    "legal_compliance_risk": "法律合规风险",
    "legal_enforcement_risk": "失信/被执行",
}


def _is_llm_configured() -> bool:
    key = os.getenv("LLM_API_KEY", "")
    return bool(key and key != "your-api-key-here")


def is_llm_configured() -> bool:
    return _is_llm_configured()


def _ensure_reply(text: str) -> str:
    cleaned = (text or "").strip()
    return cleaned if cleaned else FALLBACK_REPLY


def _template_reply(intent: str, data: dict, with_prefix: bool = True) -> str:
    prefix = TEMPLATE_PREFIX if with_prefix else ""

    if data.get("message") and not data.get("enterprise") and not data.get("ranking"):
        return _ensure_reply(prefix + str(data["message"]))

    if intent == "tax_health":
        e = data.get("enterprise", {})
        body = (
            f"{e.get('enterprise_name', '该企业')}税务健康评分{e.get('tax_health_score', '-')}分，"
            f"信用等级{e.get('credit_level', '-')}，"
            f"纳税准时率{e.get('tax_on_time_rate', '-')}。"
            f"综合风险等级{e.get('risk_level', '-')}，"
            f"建议关注税务合规与欠税情况。"
        )[:120]
        return _ensure_reply(prefix + body)

    if intent == "authenticity":
        e = data.get("enterprise", {})
        body = (
            f"{e.get('enterprise_name', '该企业')}经营真实性评分{e.get('authenticity_score', '-')}分，"
            f"营收偏差{e.get('revenue_deviation', '-')}，"
            f"发票月均{e.get('invoice_monthly_avg', '-')}。"
            f"请重点关注申报数据与经营实际是否匹配。"
        )[:120]
        return _ensure_reply(prefix + body)

    if intent == "industry_compare":
        ranking = data.get("ranking", [])
        if ranking:
            top = ranking[0]
            body = (
                f"样本企业共{len(ranking)}家，"
                f"排名第1的是{top.get('enterprise_name')}（综合分{top.get('overall_score')}），"
                f"行业均值{data.get('avg_score', '-')}分。"
                f"详见排名表与柱状图。"
            )[:120]
            return _ensure_reply(prefix + body)
        return _ensure_reply(prefix + "暂无排名数据。")

    if intent == "enterprise_pk":
        items = data.get("comparison", [])
        if len(items) >= 2:
            a, b = items[0], items[1]
            body = (
                f"{a.get('enterprise_name')}综合分{a.get('overall_score')}，"
                f"{b.get('enterprise_name')}综合分{b.get('overall_score')}。"
                f"税务/真实/财务三维对比见柱状图，"
                f"分差{abs(a.get('overall_score', 0) - b.get('overall_score', 0)):.1f}分。"
            )[:120]
            return _ensure_reply(prefix + body)
        return _ensure_reply(prefix + "请指定至少两家企业进行对比，如：对比深圳明达和上海恒信。")

    if intent == "risk_warning":
        if data.get("filter_credit_level"):
            ents = data.get("enterprises", [])
            names = "、".join(e["enterprise_name"] for e in ents[:5])
            level = data["filter_credit_level"]
            if not ents:
                return _ensure_reply(prefix + f"样本企业中暂无信用等级{level}的企业。")
            return _ensure_reply(prefix + f"信用等级{level}的企业共{len(ents)}家，包括{names}等。")
        warnings = data.get("warnings", [])
        if not warnings:
            return _ensure_reply(prefix + "当前样本企业中暂无触发预警信号的企业，整体风险可控。")
        names = "、".join(w["enterprise_name"] for w in warnings[:3])
        body = (
            f"共{len(warnings)}家企业存在预警信号，"
            f"包括{names}等。"
            f"主要信号涉及信用等级、纳税准时率及营收偏差，建议逐一排查。"
        )[:120]
        return _ensure_reply(prefix + body)

    if intent == "full_report":
        body = (
            f"{data.get('enterprise_name', '企业')}评估报告已生成，"
            f"报告编号{data.get('report_id', '-')}。"
            f"可前往企业详情页下载 PDF 报告。"
        )[:120]
        return _ensure_reply(prefix + body)

    if intent == "email_report":
        if data.get("success"):
            return _ensure_reply(prefix + f"评估报告已成功发送至 {data.get('recipient')}，请注意查收邮件附件。")
        return _ensure_reply(prefix + data.get("message", "邮件发送未完成，请下载报告后手动发送。")[:120])

    e = data.get("enterprise", {})
    if e:
        body = (
            f"{e.get('enterprise_name')}综合评分{e.get('overall_score')}分，"
            f"风险等级{e.get('risk_level')}。"
            f"税务{e.get('tax_health', '-')}、"
            f"真实性{e.get('authenticity', '-')}、"
            f"行业{e.get('industry', '-')}、"
            f"法律{e.get('legal', '-')}、"
            f"财务{e.get('finance', '-')}。"
            f"可继续提问税务、预警或对比分析。"
        )[:120]
        return _ensure_reply(prefix + body)

    body = (
        "您好，我是企业风险评估 AI 助手。"
        "您可以提问如：分析深圳明达的税务健康、行业排名、企业对比、风险预警等。"
    )[:120]
    return _ensure_reply(prefix + body)


def _llm_completion_params() -> tuple[str, dict]:
    """构建 litellm 调用参数，支持 DeepSeek / OpenAI 兼容网关"""
    model = (os.getenv("LLM_MODEL") or "deepseek-v4-pro").strip()
    params: dict = {"api_key": (os.getenv("LLM_API_KEY") or "").strip()}
    base = (os.getenv("LLM_BASE_URL") or "https://api.deepseek.com").strip().rstrip("/")
    if base:
        params["api_base"] = base
        if not model.startswith(("openai/", "azure/", "gemini/", "zhipu/", "zai/", "deepseek/")):
            model = f"openai/{model}"
    return model, params


def _llm_extra_body(model: str) -> dict | None:
    """DeepSeek V4 默认开启 thinking，对话场景需关闭以免 content 为空"""
    if "deepseek" in model.lower():
        return {"thinking": {"type": "disabled"}}
    return None


def _extract_llm_content(response) -> str:
    """从 litellm 响应中安全提取 UTF-8 文本（兼容 GLM 等格式）"""
    if not response or not getattr(response, "choices", None):
        return ""
    message = response.choices[0].message
    content = getattr(message, "content", None)
    if content is None:
        content = getattr(message, "reasoning_content", None)
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                parts.append(str(part.get("text") or part.get("content") or ""))
            else:
                parts.append(str(part))
        content = "".join(parts)
    if not isinstance(content, str):
        content = str(content) if content is not None else ""
    content = content.strip()
    if not content:
        reasoning = getattr(message, "reasoning_content", None)
        if isinstance(reasoning, str) and reasoning.strip():
            content = reasoning.strip()
    return content


async def generate_reply(query: str, intent: str, data: dict) -> str:
    if not _is_llm_configured():
        reply = _template_reply(intent, data, with_prefix=True)
        logger.info("template(no LLM) reply[:200]=%r", reply[:200])
        return reply

    try:
        import litellm

        from app.services import rate_limiter

        model, llm_params = _llm_completion_params()
        summary = json.dumps(data, ensure_ascii=False, default=str)[:800]

        completion_kwargs: dict = {
            "model": model,
            **llm_params,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是企业风险评估AI助手。"
                        "根据分析数据用50-100字中文概括，语气专业简洁，"
                        "不要编造数据中不存在的内容。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"用户问题：{query}\n分析意图：{intent}\n分析数据：{summary}",
                },
            ],
            "max_tokens": 200,
            "temperature": 0.2,
            "timeout": 45,
        }
        extra = _llm_extra_body(model)
        if extra:
            completion_kwargs["extra_body"] = extra
        api_base = llm_params.get("api_base", "")
        if not api_base:
            completion_kwargs["num_retries"] = 2
            completion_kwargs["fallbacks"] = [os.getenv("LLM_FALLBACK_MODEL", "deepseek-v4-flash")]

        response = litellm.completion(**completion_kwargs)
        raw = _extract_llm_content(response)
        logger.info("LLM raw[:200]=%r", raw[:200])

        if not raw:
            reply = _template_reply(intent, data, with_prefix=True)
            logger.info("empty LLM -> template[:200]=%r", reply[:200])
            return reply

        rate_limiter.increment()
        return _ensure_reply(raw[:150])
    except Exception as exc:
        logger.warning("LLM reply failed: %s", exc)
        reply = _template_reply(intent, data, with_prefix=True)
        logger.info("fallback template[:200]=%r", reply[:200])
        return reply
