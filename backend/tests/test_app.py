"""FastAPI 集成测试 — TestClient 验证路由可访问性"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient


def test_app_creates():
    from app.main import app
    assert app.title == "企业风险评估系统"


def test_client_health():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "data_mode" in data


def test_client_auth_register():
    from app.main import app
    client = TestClient(app)
    response = client.post("/api/v1/auth/register", json={
        "email": "integration-test@example.com",
        "password": "test123456"
    })
    assert response.status_code in (200, 400)  # 200=new, 400=duplicate


def test_client_chat():
    from app.main import app
    client = TestClient(app)
    response = client.post("/api/v1/chat", json={
        "query": "你好",
        "session_id": None
    })
    assert response.status_code in (200, 429)
    if response.status_code == 200:
        data = response.json()
        assert "reply" in data
        assert "intent" in data


def test_client_enterprise_list():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/v1/enterprise/list?page_size=3")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_all_routes_accessible():
    """验证所有路由不会 500 崩溃（返回 2xx/4xx 均可）"""
    from app.main import app
    client = TestClient(app)
    routes_to_test = [
        ("GET", "/api/v1/health"),
        ("GET", "/api/v1/enterprise/list"),
        ("GET", "/api/v1/enterprise/ENT001"),
        ("GET", "/api/v1/risk/warnings"),
        ("GET", "/api/v1/network/invoice-edges"),
        ("POST", "/api/v1/chat", {"query": "test", "session_id": None}),
    ]
    for method, path, *body in routes_to_test:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json=body[0] if body else {})
        assert resp.status_code < 500, f"{method} {path} returned {resp.status_code}"
