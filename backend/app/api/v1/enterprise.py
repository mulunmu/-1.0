from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services import assessment

router = APIRouter(prefix="/enterprise", tags=["enterprise"])


@router.get("/pk")
async def enterprise_pk(
    ids: str = Query(..., description="逗号分隔的企业ID，如 ENT001,ENT002"),
    db: AsyncSession = Depends(get_db),
):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        raise HTTPException(status_code=400, detail="ids 不能为空")
    return await assessment.calculate_pk(db, id_list)


@router.get("/{enterprise_id}")
async def get_enterprise(enterprise_id: str, db: AsyncSession = Depends(get_db)):
    result = await assessment.calculate(db, enterprise_id)
    if not result:
        raise HTTPException(status_code=404, detail="企业不存在")
    return result


@router.get("/{enterprise_id}/dimensions")
async def get_enterprise_dimensions(
    enterprise_id: str, db: AsyncSession = Depends(get_db)
):
    result = await assessment.calculate_dimensions(db, enterprise_id)
    if not result:
        raise HTTPException(status_code=404, detail="企业不存在")
    return result
