import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from app.api.v1.chat import router as chat_router
from app.api.v1.enterprise import router as enterprise_router
from app.api.v1.graph import router as graph_router
from app.api.v1.report import router as report_router
from app.api.v1.risk import router as risk_router
from app.db.session import AsyncSessionLocal
from app.models.core_metrics import CoreMetrics
from app.responses import UTF8JSONResponse
from app.services.llm_reply import is_llm_configured

app = FastAPI(title="企业风险评估系统", default_response_class=UTF8JSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enterprise_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(report_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    database = "disconnected"
    enterprise_count = 0
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            database = "connected"
            result = await db.execute(select(func.count()).select_from(CoreMetrics))
            enterprise_count = result.scalar_one()
    except Exception:
        database = "disconnected"

    return {
        "status": "ok",
        "database": database,
        "enterprise_count": enterprise_count,
        "llm_configured": is_llm_configured(),
        "mock_data": True,
    }
