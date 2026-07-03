"""生成 core_metrics + legal_events 模拟数据"""
import random
from datetime import date, timedelta

COMPANIES = [
    ("ENT001", "深圳明达科技有限公司",     "制造业", "电子设备",   "广东", "深圳"),
    ("ENT002", "上海恒信贸易集团",         "批发零售", "贸易",     "上海", "上海"),
    ("ENT003", "北京智云信息技术有限公司",  "信息技术", "软件服务",  "北京", "北京"),
    ("ENT004", "广州华南制造股份有限公司",  "制造业", "机械设备",   "广东", "广州"),
    ("ENT005", "杭州绿源新能源科技",       "新能源", "光伏",      "浙江", "杭州"),
    ("ENT006", "成都天府物流有限公司",     "物流",   "供应链",    "四川", "成都"),
    ("ENT007", "武汉光谷生物医药",         "医药",   "生物制药",  "湖北", "武汉"),
    ("ENT008", "南京金陵建筑工程",         "建筑业", "工程建设",   "江苏", "南京"),
    ("ENT009", "天津滨海港口服务",         "交通运输", "港口",      "天津", "天津"),
    ("ENT010", "重庆山城餐饮连锁",         "餐饮",   "连锁",      "重庆", "重庆"),
]

CREDIT_LEVELS = ["A", "A", "B", "B", "B", "C", "C", "D", "M"]
SOCIAL_TRENDS = ["增长", "增长", "稳定", "稳定", "稳定", "缩减"]
EVENT_TYPES = ["tax_violation", "tax_arrears", "civil_lawsuit", "execution", "admin_penalty"]


def gen_core_metrics():
    lines = [
        "CREATE TABLE IF NOT EXISTS core_metrics (",
        "  enterprise_id VARCHAR(64) PRIMARY KEY, enterprise_name VARCHAR(200),",
        "  industry_l1 VARCHAR(50), industry_l2 VARCHAR(50), province VARCHAR(50), city VARCHAR(50),",
        "  credit_level CHAR(1), credit_score NUMERIC(5,2), tax_on_time_rate NUMERIC(5,4),",
        "  tax_arrears_cnt INT, tax_violation_cnt INT, high_severity_cnt INT,",
        "  is_dishonesty BOOLEAN, is_execution BOOLEAN,",
        "  vat_revenue NUMERIC(18,2), public_revenue NUMERIC(18,2), revenue_deviation NUMERIC(5,4),",
        "  invoice_monthly_avg INT, social_trend VARCHAR(10),",
        "  market_cap NUMERIC(18,2), pe_ratio NUMERIC(10,4), revenue_yoy NUMERIC(10,4), profit_yoy NUMERIC(10,4),",
        "  roe NUMERIC(10,4), debt_ratio NUMERIC(10,4), z_score NUMERIC(10,4), z_score_level VARCHAR(10),",
        "  updated_at TIMESTAMPTZ DEFAULT now());",
    ]
    for eid, name, l1, l2, prov, city in COMPANIES:
        c = random.choice(CREDIT_LEVELS)
        cs = {"A": 95, "B": 78, "C": 62, "D": 35, "M": 50}[c] + random.uniform(-5, 5)
        v = random.randint(5000000, 5000000000)
        d = round(random.uniform(-0.15, 0.15), 4)
        p = int(v * (1 + d))
        z = round(random.uniform(0.5, 4.0), 4)
        zl = "安全" if z > 2.99 else ("灰色" if z > 1.81 else "困境")
        lines.append(
            f"INSERT INTO core_metrics VALUES "
            f"('{eid}','{name}','{l1}','{l2}','{prov}','{city}','{c}',{cs:.2f},"
            f"{random.uniform(0.75, 1):.4f},{random.randint(0, 3)},{random.randint(0, 2)},"
            f"{random.randint(0, 2)},{str(random.random() < 0.05).upper()},"
            f"{str(random.random() < 0.08).upper()},{v},{p},{d:.4f},"
            f"{random.randint(50, 2000)},'{random.choice(SOCIAL_TRENDS)}',"
            f"{random.randint(10**8, 5 * 10**10)},{round(random.uniform(5, 80), 4)},"
            f"{round(random.uniform(-0.2, 0.5), 4)},{round(random.uniform(-0.3, 0.6), 4)},"
            f"{round(random.uniform(-0.05, 0.25), 4)},{round(random.uniform(0.15, 0.8), 4)},"
            f"{z:.4f},'{zl}',NOW());"
        )
    return "\n".join(lines)


def gen_legal_events():
    lines = [
        "CREATE TABLE IF NOT EXISTS legal_events (",
        "  id SERIAL PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, event_type VARCHAR(30) NOT NULL,",
        "  severity CHAR(1) NOT NULL, amount_involved NUMERIC(18,2), event_date DATE,",
        "  description VARCHAR(200), source VARCHAR(30), created_at TIMESTAMPTZ DEFAULT now());",
    ]
    descs = {
        "tax_violation": "未按期申报增值税",
        "tax_arrears": "欠缴企业所得税",
        "civil_lawsuit": "合同纠纷被诉",
        "execution": "被列为被执行对象",
        "admin_penalty": "市场监管局行政处罚",
    }
    eid = 1
    for ent, *_ in COMPANIES:
        for _ in range(random.choices([0, 1, 2, 3], weights=[3, 3, 2, 1])[0]):
            et = random.choice(EVENT_TYPES)
            sv = random.choice(["L", "L", "L", "M", "M", "H"])
            amt = random.randint(10000, 50000000) if sv in ("M", "H") else random.randint(1000, 1000000)
            dt = (date.today() - timedelta(days=random.randint(30, 900))).isoformat()
            src = "企查查" if et in ("civil_lawsuit", "admin_penalty") else "税务数据"
            lines.append(
                f"INSERT INTO legal_events VALUES "
                f"({eid},'{ent}','{et}','{sv}',{amt},'{dt}','{descs[et]}','{src}',NOW());"
            )
            eid += 1
    return "\n".join(lines)


if __name__ == "__main__":
    with open("seed_data.sql", "w", encoding="utf-8") as f:
        f.write(gen_core_metrics() + "\n" + gen_legal_events())
    print("seed_data.sql 已生成")
