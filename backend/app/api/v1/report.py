import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.services import assessment, email_service, report_generator, mock_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/report", tags=["report"])


class GenerateReportRequest(BaseModel):
    enterprise_id: str


class EmailReportRequest(BaseModel):
    enterprise_id: str
    recipient: EmailStr


@router.get("/list")
async def list_reports(_user: dict | None = Depends(get_current_user_optional)):
    """返回已生成的报告列表（仅文件名中的企业ID和时间戳）"""
    import re
    reports = []
    reports_dir = report_generator.REPORTS_DIR
    if reports_dir.exists():
        for f in sorted(reports_dir.glob("*.pdf"), reverse=True):
            match = re.match(r"^([A-Z0-9]+)_(\d{8})_(\d{6})\.pdf$", f.name)
            if match:
                eid = match.group(1)
                # 从 mock 数据补全企业名称和风险等级
                ent = mock_data.get_mock_enterprise(eid)
                reports.append({
                    "report_id": f.stem,
                    "enterprise_id": eid,
                    "enterprise_name": ent["enterprise_name"] if ent else eid,
                    "risk_level": ent["risk_level"] if ent else "未知",
                    "overall_score": ent["overall_score"] if ent else 0,
                    "date": f"{match.group(2)[:4]}-{match.group(2)[4:6]}-{match.group(2)[6:8]}",
                    "size": f.stat().st_size,
                })
    return {"items": reports, "total": len(reports), "source": "generated"}


@router.post("/generate")
async def generate_report(
    body: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    try:
        report_id, _ = await report_generator.generate_report(db, body.enterprise_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        # DB 不可用时返回 mock 报告 ID（chat_router 已处理 mock 完整流程）
        mock_ent = mock_data.get_mock_enterprise(body.enterprise_id)
        if mock_ent:
            report_id = f"mock-{uuid.uuid4().hex[:8]}"
            logger.info("Mock report generated: %s for %s", report_id, body.enterprise_id)
            return {
                "report_id": report_id,
                "status": "completed",
                "source": "mock",
                "note": "模拟数据报告，真实数据导入后将自动替换为完整 PDF",
            }
        raise HTTPException(status_code=500, detail=f"报告生成失败: {exc}") from exc
    return {"report_id": report_id, "status": "completed"}


@router.post("/email")
async def email_report(
    body: EmailReportRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict | None = Depends(get_current_user_optional),
):
    if not email_service.is_configured():
        return {"success": False, "message": email_service.NOT_CONFIGURED_MSG}

    try:
        enterprise = await assessment.calculate(db, body.enterprise_id)
        if not enterprise:
            raise HTTPException(status_code=404, detail="企业不存在")

        _, pdf_path = await report_generator.generate_report(db, body.enterprise_id)
        email_service.send_report(
            recipient=body.recipient,
            enterprise_name=enterprise["enterprise_name"],
            pdf_path=pdf_path,
        )
        return {
            "success": True,
            "message": f"报告已发送至 {body.recipient}",
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"邮件发送失败: {exc}") from exc


@router.get("/{report_id}/download")
async def download_report(report_id: str, _user: dict | None = Depends(get_current_user_optional)):
    path = report_generator.get_report_path(report_id)
    if not path:
        raise HTTPException(status_code=404, detail="报告不存在")
    filename = f"评估报告_{report_id}.pdf"
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=filename,
    )
