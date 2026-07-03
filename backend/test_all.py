"""全功能自动化测试 — 一键运行 python test_all.py"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000/api/v1"
PASS, FAIL = 0, 0
results = []


def _record(name: str, ok: bool, detail: str) -> None:
    global PASS, FAIL
    status = "PASS" if ok else "FAIL"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    line = f"[{status}] {name}: {detail}"
    results.append(line)
    print(line)


def api_get(path: str, timeout: int = 60) -> tuple[int, str]:
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8")


def api_post(path: str, body: dict, timeout: int = 90) -> tuple[int, str]:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8")


def api_get_bytes(path: str, timeout: int = 60) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        headers = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, resp.read(), headers


def test_get(name: str, path: str, expect: int = 200, expect_key: str | None = None) -> None:
    try:
        code, text = api_get(path)
        if code != expect:
            _record(name, False, f"HTTP {code} != {expect}: {text[:200]}")
            return
        if expect_key and expect_key not in text:
            _record(name, False, f"missing key '{expect_key}': {text[:200]}")
            return
        _record(name, True, f"HTTP {code}, size={len(text)}")
    except Exception as e:
        _record(name, False, str(e)[:200])


def test_download(name: str, path: str, expect: int = 200) -> None:
    try:
        code, data, headers = api_get_bytes(path)
        if code != expect:
            _record(name, False, f"HTTP {code} != {expect}")
            return
        if not data.startswith(b"%PDF"):
            _record(name, False, f"not a PDF, size={len(data)}")
            return
        ctype = headers.get("content-type", "")
        _record(name, True, f"HTTP {code}, size={len(data)}, type={ctype}")
    except Exception as e:
        _record(name, False, str(e)[:200])


def test_post(name: str, path: str, body: dict, expect: int = 200, expect_key: str | None = None) -> None:
    try:
        code, text = api_post(path, body)
        if code != expect:
            _record(name, False, f"HTTP {code} != {expect}: {text[:200]}")
            return
        if expect_key and expect_key not in text:
            _record(name, False, f"missing key '{expect_key}': {text[:200]}")
            return
        _record(name, True, f"HTTP {code}, size={len(text)}")
    except Exception as e:
        _record(name, False, str(e)[:200])


print("=" * 60)
print("全功能自动化测试")
print("=" * 60)

# 1. 健康检查
test_get("健康检查", "/health")

# 2. 企业查询
test_get("企业查询 ENT001", "/enterprise/ENT001", expect_key="enterprise_id")

# 3. 企业PK
test_get("企业PK 3家", "/enterprise/pk?ids=ENT001,ENT005,ENT008", expect_key="enterprise_id")

# 4. 预警清单
test_get("预警清单", "/risk/warnings", expect_key="enterprise_id")

# 5. 报告生成
report_id = None
try:
    code, text = api_post("/report/generate", {"enterprise_id": "ENT001"}, timeout=120)
    data = json.loads(text)
    report_id = data.get("report_id")
    ok = code == 200 and report_id and data.get("status") == "completed"
    _record("报告生成", ok, f"report_id={report_id}, status={data.get('status')}" if ok else text[:200])
except Exception as e:
    _record("报告生成", False, str(e)[:200])

# 6. 报告下载
if report_id:
    test_download("报告下载", f"/report/{report_id}/download")
else:
    _record("报告下载", False, "skipped: no report_id")

# 7-12. AI对话测试
chat_tests = [
    ("AI对话-税务健康", {"query": "分析深圳明达科技的税务健康"}, "tax_health"),
    ("AI对话-经营真实性", {"query": "深圳明达科技的经营真实吗"}, "authenticity"),
    ("AI对话-行业对比", {"query": "跟同行比怎么样"}, "industry_compare"),
    ("AI对话-风险预警", {"query": "有什么风险信号"}, "risk_warning"),
    ("AI对话-生成报告", {"query": "生成深圳明达科技的评估报告"}, "report_id"),
    ("AI对话-PK", {"query": "对比深圳明达和杭州绿源"}, "enterprise_pk"),
    ("AI对话-复杂问法", {"query": "这家企业如果不看税务只看经营方面表现如何"}, "reply"),
]
for name, body, key in chat_tests:
    test_post(name, "/chat", body, expect_key=key)

# 13. 意图识别
try:
    r = subprocess.run(
        [sys.executable, "-c", "from app.services.intent_engine import evaluate; import json; print(json.dumps(evaluate()))"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        cwd=os.path.dirname(__file__),
    )
    data = json.loads((r.stdout or "").strip())
    ok = r.returncode == 0 and data.get("passed") is True
    _record("意图识别准确率", ok, f"accuracy={data.get('accuracy')}% passed={data.get('passed')}")
except Exception as e:
    _record("意图识别准确率", False, str(e)[:200])

# 14. 图谱路径
test_get("产业链图谱路径", "/graph/path?from=ENT001&to=ENT005")

# 15. LLM降级验证
try:
    r = subprocess.run(
        [sys.executable, "-c", "from app.services.llm_reply import LLM_NOT_CONFIGURED_MSG; print(LLM_NOT_CONFIGURED_MSG)"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
        cwd=os.path.dirname(__file__),
    )
    ok = r.returncode == 0 and bool(r.stdout.strip())
    _record("LLM降级常量", ok, r.stdout.strip() or r.stderr[:200])
except Exception as e:
    _record("LLM降级常量", False, str(e)[:200])

print("\n" + "=" * 60)
total = PASS + FAIL
print(f"通过: {PASS}/{total}  失败: {FAIL}/{total}")
print("=" * 60)
sys.exit(0 if FAIL == 0 else 1)
