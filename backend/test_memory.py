"""测试对话记忆功能 — 多轮追问是否继承上下文"""
import json, urllib.request

BASE = "http://localhost:8000/api/v1"

def chat(query, sid=None):
    body = {"query": query}
    if sid:
        body["session_id"] = sid
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/chat", data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        r = json.loads(resp.read().decode("utf-8"))
        return r.get("reply",""), r.get("intent","?"), r.get("session_id",""), r

print("=" * 60)
print("对话记忆测试")
print("=" * 60)

# 第1轮：指定企业
r1 = chat("分析深圳明达科技的税务健康", sid="test123")
print(f"\n[用户] 分析深圳明达科技的税务健康")
print(f"[AI] {r1[0][:120]}...")
print(f"  intent={r1[1]}, session={r1[2]}")

# 第2轮：追问（不指定企业——应该继承上下文知道是深圳明达）
r2 = chat("那经营真实性呢", sid=r1[2])
print(f"\n[用户] 那经营真实性呢")
print(f"[AI] {r2[0][:120]}...")
print(f"  intent={r2[1]}")

# 第3轮：追问——不指定企业，应该知道上一轮是明达
r3 = chat("跟同行比怎么样", sid=r2[2])
print(f"\n[用户] 跟同行比怎么样")
print(f"[AI] {r3[0][:120]}...")
print(f"  intent={r3[1]}")

# 验证
checks = []
# 第2轮应该提到深圳明达
if "明达" in r2[0] or "ENT001" in str(r2[3].get("data",{})):
    checks.append("✅ 第2轮继承了上下文(明达)")
else:
    checks.append("❌ 第2轮丢失了上下文")

# 第3轮应该能对比
if r3[1] in ("industry_compare",):
    checks.append("✅ 第3轮正确路由到行业对比")
else:
    checks.append(f"⚠️ 第3轮intent={r3[1]}")

print("\n" + "=" * 60)
for c in checks:
    print(c)
