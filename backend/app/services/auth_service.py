"""轻量认证服务 — 内存用户表 + JWT"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "risk-assessment-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# 演示账号 + 运行时注册用户
_users: dict[str, dict] = {
    "admin@test.com": {
        "email": "admin@test.com",
        "password_hash": hash_password("123456"),
        "role": "admin",
    }
}


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
