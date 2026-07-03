# 项目全面审计报告

> **审计范围**：23个后端文件 + 20个前端文件  
> **测试状态**：16/16 全功能 + 29/29 边界 + 20/20 意图识别 = 全部通过

---

## 一、总体评价

**代码质量：7.5/10** — 结构清晰，但存在性能隐患和缺失模块。

## 二、问题清单

### 🔴 性能问题（影响扩展性）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | `calculate()` 每次全量查询core_metrics表 | assessment.py:145-146 | O(n)/次，100家企业后响应>2秒 |
| 2 | `_all_enterprise_ids()` 每次都查全表 | chat_router.py:13-14 | 行业排名/预警每次全量扫表 |
| 3 | 无任何缓存 | 全后端 | 同一企业重复查询反复计算 |
| 4 | `calculate_pk()` 对每家企业重新构建结果 | assessment.py:165-172 | 5家PK = 5次全表扫描 |

**修复**：启动时加载全表到内存（10家数据量极小），或加 @lru_cache

### 🟡 功能缺失

| # | 缺失 | 影响 |
|---|------|------|
| 5 | 无日志系统 | 线上问题无法排查 |
| 6 | 无API限流 | LLM API费用可能失控 |
| 7 | 健康检查不含DB状态 | health端点无法反映真实健康 |
| 8 | 图谱API无真实数据 | /graph/path 永远返回空 |
| 9 | 无用户认证 | 任何人都能调用所有API |
| 10 | session_store纯内存 | 重启丢失所有会话 |

### 🟢 代码改进

| # | 建议 | 位置 |
|---|------|------|
| 11 | `_calc_tax_health` 负分未封底 | assessment.py:40-51 |
| 12 | 模板回复使用`[规则模板生成]`前缀 | llm_reply.py:11 |
| 13 | `getAllEnterprises` 硬编码10个ID | api.ts:76-80 |
| 14 | 报告下载使用Blob+createObjectURL，内存泄漏风险 | api.ts:102-114 |
| 15 | 前端缺少全局错误边界 | App.tsx |

---

## 三、快速修复清单

### 立即修（15分钟）

```
1. calculate() 加 @lru_cache(maxsize=128)
   → backend/app/services/assessment.py 加：
   from functools import lru_cache
   启动时预加载 all_metrics → 缓存到模块级变量
   
2. tax_health负分封底 → max(-50, result)

3. 健康检查加DB ping → main.py health端点加 try: db.execute("SELECT 1")

4. 前端 hardcoded ID → getAllEnterprises() 改为先调 /enterprise/pk?ids=all
   或后端加 GET /enterprise/list 返回所有企业ID列表
```

### 可选修（1小时）

```
5. 加API限流 → pip install slowapi + Redis

6. session_store加TTL（已有30分钟，确认是否生效）

7. graph_service 导入 ChainKnowledgeGraph JSON 数据 → 图谱可用

8. 加全局错误边界 → React ErrorBoundary 包装 App
```

---

## 四、企划书对照

| 企划书要求 | 实现状态 | 差距 |
|-----------|---------|------|
| 三维评估引擎 | ✅ 已实现 | — |
| 意图驱动路由 | ✅ 已实现 | 29/29边界通过 |
| AI对话 | ✅ 已实现 | 含记忆功能 |
| PDF报告 | ✅ 已实现 | Windows用fpdf2 |
| 邮件发送 | ✅ 已实现 | yagmail |
| 交易网络 | ⚠️ ECharts实现 | 图谱数据未导入 |
| 开源集成验证 | ✅ 4个仓库解压 | 权重已对齐FinRobot |
| 数据隐私合规 | ⚠️ 企划书声明了 | 代码中未体现 |

---

## 五、不能忽视的安全问题

```
⚠️ 无认证：所有API端点公开可访问。比赛Demo可接受，但需在答辩时说明。

⚠️ LLM API费用无上限：恶意调用可能导致费用暴增。
   建议：加简单的请求计数（内存中每日上限100次）

⚠️ 报告PDF含企业全名+评分，通过邮件发送时未加密。
   演示环境可接受，商业化需加密码保护。
```

---

> **结论**：代码可运行，测试全通过。10个企业的MVP完全够用。核心风险是性能（O(n)查询）和安全（无认证），两者在Demo场景下不致命。
