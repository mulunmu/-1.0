# 企业风险评估系统

多维企业风险评估平台，基于税务数据 + 公开财务 + 法律事件的三维评估引擎。

## 快速开始

```bash
# Docker 部署
docker compose up -d

# 或本地开发
cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000
cd frontend && npm install && npm run dev
```

访问 `http://localhost:5173` — 首次使用请注册账号。

## 数据模式

| 模式 | 说明 |
|------|------|
| `mock` | 纯离线演示 |
| `mock_with_llm` | 模拟数据 + AI 大模型实时回复（当前默认） |
| `live` | 真实税务数据 + 完整功能 |

## 功能

- AI 对话 — 意图驱动路由，自然语言查询
- 企业速览 — 五维雷达 + 指标卡片
- 企业 PK — 多企业并行对比
- 风险预警 — 5 个行为变化信号
- 交易网络 — 发票关系图谱
- 评估报告 — PDF 生成 + 邮件发送

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind + ECharts + Three.js
- 后端：FastAPI + SQLAlchemy + PostgreSQL + LiteLLM
- 测试：Vitest + pytest + GitHub Actions CI

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_API_KEY` | - | LLM API 密钥 |
| `AUTH_REQUIRED` | `false` | 设为 `true` 开启全部端点鉴权 |
| `CORS_ORIGINS` | `*` | CORS 允许的来源域名（逗号分隔） |
| `JWT_SECRET` | 随机生成 | JWT 签名密钥 |

## 许可证

学术研究 + 比赛演示用途。
