import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/network", tags=["network"])

_DATA = Path(__file__).resolve().parents[2] / "data" / "invoice_edges.json"


@router.get("/invoice-edges")
async def invoice_edges(_user: dict | None = Depends(get_current_user_optional)):
    if not _DATA.exists():
        logger.warning("invoice_edges.json not found at %s, returning empty list", _DATA)
        return []
    try:
        with open(_DATA, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load invoice_edges.json: %s", exc)
        return []
