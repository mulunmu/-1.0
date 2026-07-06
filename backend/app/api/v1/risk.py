import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.services import assessment, mock_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/warnings")
async def list_warnings(db: AsyncSession = Depends(get_db), _user: dict | None = Depends(get_current_user_optional)):
    try:
        result = await assessment.get_all_warnings(db)
        if result:
            return result
    except Exception as exc:
        logger.warning("DB unavailable for /warnings, using mock: %s", exc)
    return mock_data.get_mock_warnings()
