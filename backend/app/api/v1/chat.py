from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.responses import UTF8JSONResponse
from app.services.chat_router import route_chat
from app.services.llm_reply import is_llm_configured
from app.services import rate_limiter

router = APIRouter(prefix="/chat", tags=["chat"])

SESSION_NOTE = "会话记忆仅存在于当前服务周期，重启后清空"


class ChatRequest(BaseModel):
    query: str
    session_id: str | None = None


@router.post("", response_class=UTF8JSONResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    if is_llm_configured() and not rate_limiter.check_limit():
        raise HTTPException(
            status_code=429,
            detail="今日AI对话次数已用完，请明天再试",
        )

    result = await route_chat(db, body.query, session_id=body.session_id)
    result["session_note"] = SESSION_NOTE
    reply = (result.get("reply") or "").strip()
    print(f"[chat] reply[:200]={reply[:200]!r}")
    return result
