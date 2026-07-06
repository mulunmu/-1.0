"""认证依赖 — 演示阶段默认不强制（AUTH_REQUIRED=false），
生产部署时设置环境变量 AUTH_REQUIRED=true 即可开启全部端点保护"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services import auth_service

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    """读取用户身份，但不强制（返回值可能为 None）"""
    if not auth_service.AUTH_REQUIRED:
        return None
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登录才能访问此接口",
        )
    payload = auth_service.verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证无效或已过期",
        )
    return payload
