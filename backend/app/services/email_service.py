"""评估报告邮件发送（可选功能，未配置 EMAIL_* 环境变量时不影响其他功能）"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

NOT_CONFIGURED_MSG = "邮件服务未配置，请下载后手动发送"


def is_configured() -> bool:
    return bool(os.getenv("EMAIL_SENDER") and os.getenv("EMAIL_PASSWORD"))


def send_report(recipient: str, enterprise_name: str, pdf_path: Path) -> None:
    if not is_configured():
        raise RuntimeError(NOT_CONFIGURED_MSG)

    import yagmail

    sender = os.getenv("EMAIL_SENDER", "")
    password = os.getenv("EMAIL_PASSWORD", "")
    host = os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com")

    yag = yagmail.SMTP(user=sender, password=password, host=host)
    try:
        yag.send(
            to=recipient,
            subject=f"【企业风险评估】{enterprise_name} 评估报告",
            contents=[
                f"您好，\n\n附件为「{enterprise_name}」的企业风险评估报告，请查收。\n\n"
                "本报告由企业风险评估系统自动生成，仅供参考，不构成投资建议或法律意见。",
            ],
            attachments=str(pdf_path),
        )
    finally:
        yag.close()
