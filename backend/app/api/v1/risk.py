from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services import assessment

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/warnings")
async def list_warnings(db: AsyncSession = Depends(get_db)):
    return await assessment.get_all_warnings(db)
