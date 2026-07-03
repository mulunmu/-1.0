"""意图识别+AI对话 边界测试 — 找bug，不是确认happy path"""
import json, subprocess, sys, os, urllib.request

BASE = "http://localhost:8000/api/v1"
PASS, FAIL, WARN = 0, 0, 0

def chat(query):
    """调用 AI 对话 API"""
    data = json.dumps({"query": query}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/chat", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test(name, query, checks):
    """checks: list of (check_type, key, expected_behavior)"""
    global PASS, FAIL, WARN
    try:
        r = chat(query)
        intent = r.get("intent", "?")
        reply = r.get("reply", "")
        data = r.get("data", {})
        charts = r.get("charts", {})

        failures = []
        for check in checks:
            ctype = check[0]
            key = check[1] if len(check) > 1 else ""
            if ctype == "intent_is":
                if intent != key:
                    failures.append(f"intent应为{key}实际为{intent}")
            elif ctype == "intent_not":
                if intent == key:
                    failures.append(f"intent不应为{key}")
            elif ctype == "reply_has":
                if key not in reply:
                    failures.append(f"reply应包含'{key}'")
            elif ctype == "reply_not":
                if key in reply:
                    failures.append(f"reply不应包含'{key}'")
            elif ctype == "reply_not_empty":
                if not reply or len(reply) < 5:
                    failures.append("reply不应为空")
            elif ctype == "has_charts":
                if not charts or not charts.get("type"):
                    failures.append("应返回图表数据")
            elif ctype == "has_data":
                if not data:
                    failures.append("应返回数据")
            elif ctype == "no_error":
                if "error" in str(r).lower() or "失败" in reply or "抱歉" in reply:
                    failures.append(f"不应返回错误: {reply[:100]}")

        if not failures:
            PASS += 1
            print(f"  ✅ {name} → intent={intent}")
        else:
            FAIL += 1
            print(f"  ❌ {name} → intent={intent}")
            for f in failures:
                print(f"     {f}")
    except Exception as e:
        FAIL += 1
        print(f"  ❌ {name} → 异常: {str(e)[:150]}")

print("=" * 60)
print("意图识别+AI对话 边界测试")
print("=" * 60)

# ====== 场景1：正常查询（基线） ======
print("\n【场景1：正常查询】")
test("T1-税务查询", "分析深圳明达科技的税务健康",
    [("intent_is", "tax_health"), ("reply_not_empty", ""), ("has_charts", "")])
test("T1-经营真实性", "上海恒信贸易的经营真实吗",
    [("intent_is", "authenticity"), ("reply_not_empty", "")])
test("T1-行业对比", "跟同行比怎么样",
    [("intent_is", "industry_compare"), ("has_data", "")])
test("T1-风险预警", "有什么风险信号",
    [("intent_is", "risk_warning"), ("has_data", "")])
test("T1-企业PK", "对比ENT001和ENT005",
    [("intent_is", "enterprise_pk"), ("has_data", "")])
test("T1-报告生成", "生成深圳明达的评估报告",
    [("intent_is", "full_report"), ("reply_not_empty", "")])
test("T1-邮件", "把报告发我邮箱",
    [("intent_is", "email_report"), ("reply_not_empty", "")])

# ====== 场景2：模糊/不完整查询（压力测试） ======
print("\n【场景2：模糊/不完整查询】")
test("T2-无企业名分析", "分析一下税务健康",  # 没有指定企业
    [("reply_not_empty", ""), ("no_error", "")])
test("T2-只问怎么样", "这个企业怎么样",  # 指代不明
    [("reply_not_empty", ""), ("no_error", "")])
test("T2-单字", "税",  # 极短输入
    [("reply_not_empty", ""), ("no_error", "")])
test("T2-空输入", "",  # 空字符串
    [("reply_not_empty", ""), ("no_error", "")])
test("T2-纯符号", "？？？",  # 只有标点
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景3：复合意图 ======
print("\n【场景3：复合意图】")
test("T3-双意图", "分析深圳明达的税务健康并跟同行对比",
    [("reply_not_empty", ""), ("no_error", ""), ("intent_not", "chat")])
test("T3-三意图", "评估北京智云的风险，对比广州华南，生成报告",
    [("reply_not_empty", ""), ("no_error", "")])
test("T3-分析+邮件", "分析成都天府的经营真实性然后把报告发我邮箱",
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景4：企业名变体 ======
print("\n【场景4：企业名变体】")
test("T4-简称", "分析明达的税务信用",  # 部分名称
    [("reply_not_empty", ""), ("no_error", "")])
test("T4-ID查询", "查一下ENT003",  # 直接用ID
    [("reply_not_empty", ""), ("no_error", "")])
test("T4-不存在的企业", "分析特斯拉中国的税务健康",  # 不存在
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景5：风险相关边界 ======
print("\n【场景5：风险查询】")
test("T5-最差企业", "哪家企业的税务情况最差",  # 排名/筛选
    [("reply_not_empty", ""), ("no_error", "")])
test("T5-高风险", "有没有高风险的企业",  # 筛选
    [("reply_not_empty", ""), ("no_error", "")])
test("T5-D级", "信用等级D的企业有哪些",  # 具体筛选
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景6：闲聊/非业务 ======
print("\n【场景6：闲聊/非业务】")
test("T6-你好", "你好",
    [("intent_not", "tax_health"), ("intent_not", "authenticity"), ("reply_not_empty", "")])
test("T6-谢谢", "谢谢",
    [("reply_not_empty", ""), ("no_error", "")])
test("T6-无关", "今天天气怎么样",
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景7：追问/上下文 ======
print("\n【场景7：追问/上下文继承】")
test("T7-追问为什么", "为什么这么低",  # 缺少上下文
    [("reply_not_empty", ""), ("no_error", "")])
test("T7-追问怎么改善", "怎么改善",  # 缺少上下文
    [("reply_not_empty", ""), ("no_error", "")])
test("T7-追问那家呢", "那家呢",  # 缺少上下文
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 场景8：长文本/特殊输入 ======
print("\n【场景8：长文本/特殊输入】")
test("T8-长查询", "请帮我详细分析一下深圳明达科技有限公司的税务健康状况包括纳税信用等级欠税记录违法记录以及经营真实性包括增值税申报与公开财报的偏差发票活跃度社保员工变化趋势最后跟同行业对比一下",
    [("reply_not_empty", ""), ("no_error", "")])
test("T8-英文混搭", "分析ENT001的tax health和ROE表现",
    [("reply_not_empty", ""), ("no_error", "")])

# ====== 汇总 ======
print("\n" + "=" * 60)
total = PASS + FAIL
print(f"通过: {PASS}/{total}  失败: {FAIL}/{total}")
if FAIL > 0:
    print("⚠️ 存在失败项，需修复")
    sys.exit(1)
else:
    print("✅ 全部通过")
