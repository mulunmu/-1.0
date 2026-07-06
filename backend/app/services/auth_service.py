"""轻量认证服务 — 内存用户表 + JWT"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

# 生产环境必须通过环境变量设置；演示环境每次启动生成随机密钥
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# 运行时注册用户（演示阶段无持久化存储）。首次使用请注册新账号。
_users: dict[str, dict] = {}


def register_user(email: str, password: str) -> None:
    email = email.strip().lower()
    if email in _users:
        raise ValueError("邮箱已注册")
    if len(password) < 6:
        raise ValueError("密码至少6位")
    _users[email] = {
        "email": email,
        "password_hash": hash_password(password),
        "role": "user",
    }


def authenticate_user(email: str, password: str) -> dict | None:
    email = email.strip().lower()
    user = _users.get(email)
    if not user or not verify_password(password, user["password_hash"]):
        return None
    return user


def create_access_token(email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": email, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """验证 JWT 令牌，返回 payload 或 None"""
    try:
        token = token.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload if payload.get("sub") else None
    except Exception:
        return None


# 演示阶段：设置 AUTH_REQUIRED=false 可跳过认证检查
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"
