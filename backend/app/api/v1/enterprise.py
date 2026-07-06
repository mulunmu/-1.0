import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.services import assessment, mock_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/enterprise", tags=["enterprise"])


@router.get("/list")
async def list_enterprises(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    risk_level: str | None = Query(None, description="按风险等级筛选：低风险/中低风险/中等风险/中高风险/高风险"),
    db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    """返回企业评估数据（分页 + 可选风险筛选）"""
    try:
        result = await assessment.list_all(db)
        if result:
            items = result
            if risk_level:
                items = [e for e in items if e.get("risk_level") == risk_level]
            total = len(items)
            start = (page - 1) * page_size
            end = start + page_size
            return {
                "items": items[start:end],
                "total": total,
                "page": page,
                "page_size": page_size,
                "pages": max(1, (total + page_size - 1) // page_size),
            }
    except Exception as exc:
        logger.warning("DB unavailable for /list, using mock: %s", exc)
    all_mock = mock_data.get_all_mock_enterprises()
    if risk_level:
        all_mock = [e for e in all_mock if e.get("risk_level") == risk_level]
    total = len(all_mock)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": all_mock[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "source": "mock",
    }


@router.get("/pk")
async def enterprise_pk(
    ids: str = Query(..., description="逗号分隔的企业ID，如 ENT001,ENT002"),
    db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        raise HTTPException(status_code=400, detail="ids 不能为空")
    try:
        result = await assessment.calculate_pk(db, id_list)
        if result:
            return result
    except Exception as exc:
        logger.warning("DB unavailable for /pk, using mock: %s", exc)
    pk_results = [mock_data.get_mock_enterprise(eid) for eid in id_list]
    return [r for r in pk_results if r]


@router.get("/{enterprise_id}/legal-events")
async def get_enterprise_legal_events(
    enterprise_id: str, db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    try:
        result = await assessment.calculate(db, enterprise_id)
        if result:
            events = await assessment.get_legal_events(db, enterprise_id)
            if events:
                return events
    except Exception as exc:
        logger.warning("DB unavailable for legal-events, using mock: %s", exc)
    m_events = mock_data.get_mock_legal_events(enterprise_id)
    if not m_events:
        return []
    return m_events


@router.get("/{enterprise_id}/dimensions")
async def get_enterprise_dimensions(
    enterprise_id: str, db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    try:
        result = await assessment.calculate_dimensions(db, enterprise_id)
        if result:
            return result
    except Exception as exc:
        logger.warning("DB unavailable for dimensions, using mock: %s", exc)
    ent = mock_data.get_mock_enterprise(enterprise_id)
    if not ent:
        raise HTTPException(status_code=404, detail="企业不存在")
    return {"dimensions": ent["dimensions"], "source": "mock"}


@router.get("/{enterprise_id}")
async def get_enterprise(enterprise_id: str, db: AsyncSession = Depends(get_db), _user: dict | None = Depends(get_current_user_optional)):
    try:
        result = await assessment.calculate(db, enterprise_id)
        if result:
            return result
    except Exception as exc:
        logger.warning("DB unavailable for enterprise, using mock: %s", exc)
    ent = mock_data.get_mock_enterprise(enterprise_id)
    if not ent:
        raise HTTPException(status_code=404, detail="企业不存在")
    return ent
