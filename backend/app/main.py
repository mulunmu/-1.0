import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.enterprise import router as enterprise_router
from app.api.v1.graph import router as graph_router
from app.api.v1.network import router as network_router
from app.api.v1.report import router as report_router
from app.api.v1.risk import router as risk_router
from app.db.session import AsyncSessionLocal
from app.models.core_metrics import CoreMetrics
from app.responses import UTF8JSONResponse
from app.services.llm_reply import is_llm_configured
from app.services import rate_limiter

logger = logging.getLogger(__name__)

app = FastAPI(
    title="企业风险评估系统",
    description="""## 多维企业风险评估 API

基于税务数据 + 公开财务 + 法律事件的三维评估引擎。

### 数据模式
- **mock** — 纯离线演示模式（无后端）
- **mock_with_llm** — 模拟数据 + AI 大模型实时回复
- **live** — 真实税务数据 + AI 大模型

### 认证
演示阶段默认不强制认证。设置 `AUTH_REQUIRED=true` 开启 JWT 保护。
""",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    default_response_class=UTF8JSONResponse)

# CORS — 演示阶段允许所有来源；生产环境应限制为前端域名
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API 速率限制中间件
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    # 跳过健康检查
    if path == "/api/v1/health":
        return await call_next(request)
    if not rate_limiter.check_api_limit():
        return JSONResponse(status_code=429, content={"detail": "请求过于频繁，请稍后重试"})
    rate_limiter.record_api_call()
    response = await call_next(request)
    return response


app.include_router(auth_router, prefix="/api/v1")
app.include_router(enterprise_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(report_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")
app.include_router(network_router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    database = "disconnected"
    enterprise_count = 0
    data_mode = "mock"
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
            database = "connected"
            result = await db.execute(select(func.count()).select_from(CoreMetrics))
            enterprise_count = result.scalar_one()
            data_mode = "live" if enterprise_count > 0 else "mock"
    except Exception:
        database = "disconnected"
        data_mode = "mock"

    llm_available = is_llm_configured()

    return {
        "status": "ok",
        "database": database,
        "enterprise_count": enterprise_count,
        "llm_configured": llm_available,
        "data_mode": data_mode if data_mode == "live" else ("mock_with_llm" if llm_available else "mock"),
    }
