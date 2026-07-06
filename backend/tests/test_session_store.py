"""会话存储单元测试"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_ensure_session_id():
    from app.services.session_store import ensure_session_id
    sid1 = ensure_session_id(None)
    assert len(sid1) > 0
    sid2 = ensure_session_id("")
    assert len(sid2) > 0
    sid3 = ensure_session_id("my-session")
    assert sid3 == "my-session"


def test_store_and_retrieve():
    from app.services.session_store import ensure_session_id, store_session, get_session
    sid = ensure_session_id("test-123")
    store_session(sid, "tax_health", ["ENT001"], "测试问题", ["深圳明达科技"])
    session = get_session(sid)
    assert session is not None
    assert session.get("last_intent") == "tax_health"
    assert "ENT001" in session.get("enterprises", [])


def test_expired_session():
    from app.services.session_store import get_session
    # 不存在的 session 返回 None
    s = get_session("nonexistent-session-id")
    assert s is None
