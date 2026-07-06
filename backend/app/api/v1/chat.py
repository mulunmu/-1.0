import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.responses import UTF8JSONResponse
from app.services.chat_router import route_chat
from app.services.llm_reply import is_llm_configured
from app.services import rate_limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

SESSION_NOTE = "会话记忆仅存在于当前服务周期，重启后清空"


class ChatRequest(BaseModel):
    query: str
    session_id: str | None = None


@router.post("", response_class=UTF8JSONResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db), _user: dict | None = Depends(get_current_user_optional)):
    if not rate_limiter.check_api_limit():
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后重试")
    if is_llm_configured() and not rate_limiter.check_llm_limit():
        raise HTTPException(
            status_code=429,
            detail="今日AI对话次数已用完，请明天再试",
        )

    try:
        result = await route_chat(db, body.query, session_id=body.session_id)
    except Exception as exc:
        logger.warning("chat DB unavailable, using mock fallback: %s", exc)
        from app.services.intent_engine import recognize
        from app.services.llm_reply import _template_reply
        intent_result = recognize(body.query, use_llm=False)
        reply = _template_reply(intent_result.intent, {}, with_prefix=True)
        result = {
            "reply": reply,
            "intent": intent_result.intent,
            "data": {"source": "mock_fallback"},
            "charts": None,
            "session_id": body.session_id,
        }

    result["session_note"] = SESSION_NOTE
    reply = (result.get("reply") or "").strip()
    logger.info("chat reply[:200]=%r", reply[:200])
    return result
