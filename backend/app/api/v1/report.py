from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services import assessment, email_service, report_generator

router = APIRouter(prefix="/report", tags=["report"])


class GenerateReportRequest(BaseModel):
    enterprise_id: str


class EmailReportRequest(BaseModel):
    enterprise_id: str
    recipient: EmailStr


@router.post("/generate")
async def generate_report(
    body: GenerateReportRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        report_id, _ = await report_generator.generate_report(db, body.enterprise_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"报告生成失败: {exc}") from exc
    return {"report_id": report_id, "status": "completed"}


@router.post("/email")
async def email_report(
    body: EmailReportRequest,
    db: AsyncSession = Depends(get_db),
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
async def download_report(report_id: str):
    path = report_generator.get_report_path(report_id)
    if not path:
        raise HTTPException(status_code=404, detail="报告不存在")
    filename = f"评估报告_{report_id}.pdf"
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=filename,
    )
