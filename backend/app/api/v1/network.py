import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/network", tags=["network"])

_DATA = Path(__file__).resolve().parents[2] / "data" / "invoice_edges.json"


@router.get("/invoice-edges")
async def invoice_edges():
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)
