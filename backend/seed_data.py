"""生成 200 家企业 core_metrics + legal_events + invoice_edges 模拟数据，并导入 PostgreSQL"""
from __future__ import annotations

import asyncio
import json
import random
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from pinyin_util import name_initials

# ENT001-ENT010 保留供测试/意图识别
LEGACY_COMPANIES = [
    ("ENT001", "深圳明达科技有限公司", "制造业", "电子设备", "广东", "深圳"),
    ("ENT002", "上海恒信贸易集团", "批发零售", "进出口贸易", "上海", "上海"),
    ("ENT003", "北京智云信息技术有限公司", "信息技术", "软件服务", "北京", "北京"),
    ("ENT004", "广州华南制造股份有限公司", "制造业", "机械设备", "广东", "广州"),
    ("ENT005", "杭州绿源新能源科技", "新能源", "光伏组件", "浙江", "杭州"),
    ("ENT006", "成都天府物流有限公司", "交通运输", "供应链物流", "四川", "成都"),
    ("ENT007", "武汉光谷生物医药", "医药", "生物制药", "湖北", "武汉"),
    ("ENT008", "南京金陵建筑工程", "建筑业", "工程建设", "江苏", "南京"),
    ("ENT009", "天津滨海港口服务", "交通运输", "港口服务", "天津", "天津"),
    ("ENT010", "重庆山城餐饮连锁", "餐饮", "连锁餐饮", "重庆", "重庆"),
]

# 行业分布 200 家
INDUSTRY_PLAN: list[tuple[str, int, list[str]]] = [
    ("制造业", 40, ["电子设备", "机械设备", "汽车零部件", "精密加工", "金属制品"]),
    ("信息技术", 35, ["软件服务", "云计算", "人工智能", "信息系统", "网络安全"]),
    ("批发零售", 30, ["进出口贸易", "批发零售", "连锁超市", "电商运营", "供应链贸易"]),
    ("建筑业", 25, ["工程建设", "装饰装修", "市政工程", "钢结构", "幕墙工程"]),
    ("交通运输", 20, ["供应链物流", "港口服务", "冷链运输", "公路货运", "仓储配送"]),
    ("新能源", 15, ["光伏组件", "风电设备", "储能系统", "锂电池", "充电桩"]),
    ("医药", 15, ["生物制药", "医疗器械", "化学制药", "中药饮片", "医药流通"]),
    ("餐饮", 10, ["连锁餐饮", "中央厨房", "团餐服务", "食品配送", "品牌加盟"]),
    ("金融", 10, ["小额贷款", "融资租赁", "商业保理", "投资咨询", "资产管理"]),
]

REGIONS = [
    ("广东", "深圳"), ("广东", "广州"), ("广东", "东莞"), ("广东", "佛山"),
    ("上海", "上海"), ("北京", "北京"), ("浙江", "杭州"), ("浙江", "宁波"),
    ("江苏", "南京"), ("江苏", "苏州"), ("四川", "成都"), ("湖北", "武汉"),
    ("天津", "天津"), ("重庆", "重庆"), ("山东", "青岛"), ("福建", "厦门"),
    ("河南", "郑州"), ("湖南", "长沙"), ("安徽", "合肥"), ("陕西", "西安"),
]

NAME_CORE = [
    "汇通", "鑫源", "恒达", "博远", "华创", "盛泰", "嘉禾", "新锐", "天成", "宏图",
    "智联", "金鼎", "远洋", "中汇", "国联", "正信", "德盛", "瑞丰", "广汇", "新纪元",
    "联合", "东方", "西部", "南方", "北方", "长江", "黄河", "珠江", "滨海", "高新",
]

SUFFIXES = ["有限公司", "股份有限公司", "集团有限公司", "实业有限公司"]

EVENT_TYPES = ["tax_violation", "tax_arrears", "dishonesty", "execution", "civil_lawsuit", "admin_penalty"]
EVENT_DESCS = {
    "tax_violation": "未按期申报增值税",
    "tax_arrears": "欠缴企业所得税",
    "dishonesty": "列入失信被执行人名单",
    "execution": "被列为被执行对象",
    "civil_lawsuit": "合同纠纷被诉",
    "admin_penalty": "市场监管局行政处罚",
}

# 200 家分段
SEGMENTS: list[tuple[str, int, int]] = [
    ("normal", 1, 100),
    ("high_risk", 101, 130),
    ("anomaly", 131, 150),
    ("excellent", 151, 170),
    ("boundary", 171, 180),
    ("non_listed", 181, 190),
    ("new_reg", 191, 200),
]

random.seed(42)


def _eid(n: int) -> str:
    return f"ENT{n:03d}"


def _segment_for(idx: int) -> str:
    for seg, start, end in SEGMENTS:
        if start <= idx <= end:
            return seg
    return "normal"


def _build_industry_assignments() -> list[tuple[str, str]]:
    """返回 200 个 (industry_l1, industry_l2)"""
    out: list[tuple[str, str]] = []
    for l1, count, l2_pool in INDUSTRY_PLAN:
        for _ in range(count):
            out.append((l1, random.choice(l2_pool)))
    random.shuffle(out)
    return out


def _real_name(city: str, l1: str, idx: int) -> str:
    if idx <= 10:
        return next(c[1] for c in LEGACY_COMPANIES if c[0] == _eid(idx))
    core = random.choice(NAME_CORE)
    suffix = random.choice(SUFFIXES)
    # 真实格式：深圳市XX电子有限公司 / 上海市XX贸易有限公司
    industry_word = {
        "制造业": "精密制造", "信息技术": "信息科技", "批发零售": "贸易",
        "建筑业": "建设工程", "交通运输": "物流", "新能源": "新能源",
        "医药": "医药", "餐饮": "餐饮管理", "金融": "金融服务",
    }.get(l1, "实业")
    if random.random() < 0.6:
        return f"{city}市{core}{industry_word}{suffix}"
    return f"{city}{core}{industry_word}{suffix}"


def _base_row(
    eid: str, name: str, l1: str, l2: str, prov: str, city: str, seg: str,
) -> dict:
    z = round(random.uniform(0.8, 3.8), 4)
    zl = "安全" if z > 2.99 else ("灰色" if z > 1.81 else "困境")
    v = random.randint(5_000_000, 8_000_000_000)
    row = {
        "enterprise_id": eid,
        "enterprise_name": name,
        "industry_l1": l1,
        "industry_l2": l2,
        "province": prov,
        "city": city,
        "credit_level": "B",
        "credit_score": Decimal("78.00"),
        "tax_on_time_rate": Decimal("0.9200"),
        "tax_arrears_cnt": 0,
        "tax_violation_cnt": 0,
        "high_severity_cnt": 0,
        "is_dishonesty": False,
        "is_execution": False,
        "vat_revenue": Decimal(str(v)),
        "public_revenue": Decimal(str(int(v * random.uniform(1.02, 1.08)))),
        "revenue_deviation": Decimal(str(round(random.uniform(0.02, 0.12), 4))),
        "invoice_monthly_avg": random.randint(200, 2500),
        "social_trend": random.choice(["增长", "稳定", "稳定"]),
        "market_cap": Decimal(str(random.randint(10**8, 5 * 10**10))),
        "pe_ratio": Decimal(str(round(random.uniform(8, 60), 4))),
        "revenue_yoy": Decimal(str(round(random.uniform(-0.05, 0.35), 4))),
        "profit_yoy": Decimal(str(round(random.uniform(-0.2, 0.5), 4))),
        "roe": Decimal(str(round(random.uniform(0.02, 0.22), 4))),
        "debt_ratio": Decimal(str(round(random.uniform(0.25, 0.65), 4))),
        "z_score": Decimal(str(z)),
        "z_score_level": zl,
        "_segment": seg,
    }

    if seg == "normal":
        row["credit_level"] = random.choice(["A", "A", "B", "B", "B", "C"])
        row["credit_score"] = Decimal(str({"A": 93, "B": 76, "C": 62}[row["credit_level"]] + random.uniform(-4, 4)))
        row["tax_on_time_rate"] = Decimal(str(round(random.uniform(0.82, 0.99), 4)))
        row["tax_arrears_cnt"] = random.randint(0, 1)
        row["tax_violation_cnt"] = random.randint(0, 1)
    elif seg == "high_risk":
        row["credit_level"] = random.choice(["D", "M", "D", "M", "C"])
        row["credit_score"] = Decimal(str(random.uniform(25, 48)))
        row["tax_on_time_rate"] = Decimal(str(round(random.uniform(0.55, 0.78), 4)))
        row["tax_arrears_cnt"] = random.randint(2, 5)
        row["tax_violation_cnt"] = random.randint(2, 4)
        row["high_severity_cnt"] = random.randint(1, 3)
        row["is_dishonesty"] = True
        row["is_execution"] = True
    elif seg == "anomaly":
        row["credit_level"] = random.choice(["B", "C", "C"])
        row["credit_score"] = Decimal(str(random.uniform(55, 72)))
        row["revenue_deviation"] = Decimal(str(round(random.uniform(0.31, 0.55), 4)))
        row["invoice_monthly_avg"] = random.randint(10, 80)
        row["social_trend"] = "缩减"
    elif seg == "excellent":
        row["credit_level"] = "A"
        row["credit_score"] = Decimal(str(random.uniform(92, 99)))
        row["tax_on_time_rate"] = Decimal(str(round(random.uniform(0.96, 1.0), 4)))
        row["tax_arrears_cnt"] = 0
        row["tax_violation_cnt"] = 0
        row["social_trend"] = "增长"
        row["revenue_yoy"] = Decimal(str(round(random.uniform(0.15, 0.45), 4)))
        row["roe"] = Decimal(str(round(random.uniform(0.12, 0.28), 4)))
    elif seg == "boundary":
        row["credit_level"] = random.choice(["B", "C"])
        row["debt_ratio"] = Decimal(str(round(random.uniform(0.92, 0.99), 4)))
        row["invoice_monthly_avg"] = random.choice([0, 0, 5, 12])
        row["z_score_level"] = "困境"
        row["revenue_deviation"] = Decimal(str(round(random.uniform(0.2, 0.45), 4)))
    elif seg == "non_listed":
        row["industry_l1"] = "非上市"
        row["industry_l2"] = "私营"
        row["market_cap"] = Decimal("0")
        row["pe_ratio"] = Decimal("0")
    elif seg == "new_reg":
        row["industry_l2"] = "新注册"
        row["invoice_monthly_avg"] = random.randint(5, 40)
        row["social_trend"] = "稳定"
        row["revenue_yoy"] = Decimal("0")
        row["credit_level"] = random.choice(["B", "C"])

    if eid in {c[0] for c in LEGACY_COMPANIES}:
        leg = next(c for c in LEGACY_COMPANIES if c[0] == eid)
        row["enterprise_name"] = leg[1]
        row["industry_l1"] = leg[2]
        row["industry_l2"] = leg[3]
        row["province"] = leg[4]
        row["city"] = leg[5]
        if eid == "ENT001":
            row.update({
                "credit_level": "B",
                "credit_score": Decimal("76.53"),
                "tax_on_time_rate": Decimal("0.9825"),
                "tax_arrears_cnt": 3,
                "tax_violation_cnt": 0,
                "revenue_deviation": Decimal("0.0552"),
                "invoice_monthly_avg": 847,
                "social_trend": "增长",
                "z_score_level": "困境",
            })
        if eid == "ENT007":
            row.update({"credit_level": "D", "credit_score": Decimal("34.28")})

    return row


def generate_companies() -> list[dict]:
    industries = _build_industry_assignments()
    companies: list[dict] = []
    for idx in range(1, 201):
        eid = _eid(idx)
        seg = _segment_for(idx)
        if idx <= 10:
            leg = next(c for c in LEGACY_COMPANIES if c[0] == eid)
            prov, city, l1, l2, name = leg[4], leg[5], leg[2], leg[3], leg[1]
        else:
            prov, city = random.choice(REGIONS)
            l1, l2 = industries[idx - 1]
            name = _real_name(city, l1, idx)
        companies.append(_base_row(eid, name, l1, l2, prov, city, seg))
    return companies


def generate_legal_events(companies: list[dict]) -> list[dict]:
    """每家企业 0-3 条，合计约 400 条"""
    events: list[dict] = []
    eid_seq = 1
    for co in companies:
        seg = co["_segment"]
        if seg == "high_risk":
            n = random.randint(2, 3)
            pool = list(EVENT_TYPES)
        elif seg == "excellent":
            n = 0
            pool = EVENT_TYPES
        elif seg == "anomaly":
            n = random.randint(0, 2)
            pool = ["civil_lawsuit", "admin_penalty", "tax_arrears"]
        else:
            n = random.randint(0, 3)
            pool = EVENT_TYPES

        chosen = random.sample(pool, min(n, len(pool))) if n else []
        for et in chosen:
            sv = random.choice(["L", "L", "M", "M", "H"])
            amt = random.randint(5000, 30_000_000) if sv in ("M", "H") else random.randint(1000, 500_000)
            dt = date.today() - timedelta(days=random.randint(30, 900))
            src = "企查查" if et in ("civil_lawsuit", "admin_penalty", "dishonesty", "execution") else "税务数据"
            events.append({
                "id": eid_seq,
                "enterprise_id": co["enterprise_id"],
                "event_type": et,
                "severity": sv,
                "amount_involved": Decimal(str(amt)),
                "event_date": dt,
                "description": EVENT_DESCS[et],
                "source": src,
            })
            eid_seq += 1
    return events


def generate_invoice_edges(companies: list[dict], target: int = 2000) -> list[dict]:
    """模拟 syx_invoice 交易关系边"""
    edges: list[dict] = []
    by_industry: dict[str, list[str]] = {}
    for c in companies:
        by_industry.setdefault(c["industry_l1"], []).append(c["enterprise_id"])

    ids = [c["enterprise_id"] for c in companies]
    seen: set[tuple[str, str]] = set()

    def add_edge(a: str, b: str, amount: int, invoice_type: str) -> None:
        if a == b:
            return
        key = (min(a, b), max(a, b))
        if key in seen:
            return
        seen.add(key)
        edges.append({
            "source_id": a,
            "target_id": b,
            "amount": amount,
            "invoice_type": invoice_type,
            "invoice_date": (date.today() - timedelta(days=random.randint(1, 365))).isoformat(),
        })

    # 同行业内交易（约 70%）
    for ind_ids in by_industry.values():
        for _ in range(len(ind_ids) * 3):
            if len(edges) >= int(target * 0.7):
                break
            a, b = random.sample(ind_ids, 2) if len(ind_ids) >= 2 else (None, None)
            if a and b:
                add_edge(a, b, random.randint(10_000, 5_000_000), "增值税专用发票")

    # 跨行业交易
    while len(edges) < target:
        a, b = random.sample(ids, 2)
        add_edge(a, b, random.randint(5_000, 2_000_000), random.choice(["增值税专用发票", "普通发票", "电子发票"]))

    return edges[:target]


def write_sql(companies: list[dict], events: list[dict]) -> str:
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
        "CREATE TABLE IF NOT EXISTS legal_events (",
        "  id SERIAL PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, event_type VARCHAR(30) NOT NULL,",
        "  severity CHAR(1) NOT NULL, amount_involved NUMERIC(18,2), event_date DATE,",
        "  description VARCHAR(200), source VARCHAR(30), created_at TIMESTAMPTZ DEFAULT now());",
        "DELETE FROM legal_events;",
        "DELETE FROM core_metrics;",
    ]
    for c in companies:
        name = c["enterprise_name"].replace("'", "''")
        lines.append(
            "INSERT INTO core_metrics VALUES ("
            f"'{c['enterprise_id']}','{name}','{c['industry_l1']}','{c['industry_l2']}',"
            f"'{c['province']}','{c['city']}','{c['credit_level']}',{c['credit_score']},"
            f"{c['tax_on_time_rate']},{c['tax_arrears_cnt']},{c['tax_violation_cnt']},{c['high_severity_cnt']},"
            f"{str(c['is_dishonesty']).upper()},{str(c['is_execution']).upper()},"
            f"{c['vat_revenue']},{c['public_revenue']},{c['revenue_deviation']},"
            f"{c['invoice_monthly_avg']},'{c['social_trend']}',"
            f"{c['market_cap']},{c['pe_ratio']},{c['revenue_yoy']},{c['profit_yoy']},"
            f"{c['roe']},{c['debt_ratio']},{c['z_score']},'{c['z_score_level']}',NOW());"
        )
    for e in events:
        lines.append(
            f"INSERT INTO legal_events (id, enterprise_id, event_type, severity, amount_involved, "
            f"event_date, description, source, created_at) VALUES ("
            f"{e['id']},'{e['enterprise_id']}','{e['event_type']}','{e['severity']}',{e['amount_involved']},"
            f"'{e['event_date'].isoformat()}','{e['description']}','{e['source']}',NOW());"
        )
    lines.append(
        "SELECT setval(pg_get_serial_sequence('legal_events','id'), "
        "(SELECT COALESCE(MAX(id),1) FROM legal_events));"
    )
    return "\n".join(lines)


def write_registry(companies: list[dict]) -> None:
    registry = [
        {
            "id": c["enterprise_id"],
            "name": c["enterprise_name"],
            "industry_l1": c["industry_l1"],
            "initials": name_initials(c["enterprise_name"]),
        }
        for c in companies
    ]
    path = Path(__file__).resolve().parent / "app" / "data" / "companies_registry.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")


def write_invoice_edges(edges: list[dict]) -> None:
    path = Path(__file__).resolve().parent / "app" / "data" / "invoice_edges.json"
    path.write_text(json.dumps(edges, ensure_ascii=False, indent=2), encoding="utf-8")


async def import_to_db(companies: list[dict], events: list[dict]) -> None:
    from sqlalchemy import delete, text

    from app.db.session import AsyncSessionLocal
    from app.models.core_metrics import CoreMetrics, LegalEvent
    from app.services import assessment

    async with AsyncSessionLocal() as db:
        await db.execute(delete(LegalEvent))
        await db.execute(delete(CoreMetrics))
        await db.flush()

        for c in companies:
            row = {k: v for k, v in c.items() if not k.startswith("_")}
            db.add(CoreMetrics(**row))
        for e in events:
            db.add(
                LegalEvent(
                    enterprise_id=e["enterprise_id"],
                    event_type=e["event_type"],
                    severity=e["severity"],
                    amount_involved=e["amount_involved"],
                    event_date=e["event_date"],
                    description=e["description"],
                    source=e["source"],
                )
            )
        await db.commit()

        assessment._CACHE["metrics"] = []
        assessment._CACHE["legal_by_ent"] = {}
        await assessment.refresh_cache(db)

        cnt = await db.scalar(text("SELECT COUNT(*) FROM core_metrics"))
        ev_cnt = await db.scalar(text("SELECT COUNT(*) FROM legal_events"))
        print(f"已导入 core_metrics: {cnt} 条, legal_events: {ev_cnt} 条")


async def main_async() -> None:
    companies = generate_companies()
    events = generate_legal_events(companies)
    invoice_edges = generate_invoice_edges(companies, target=2000)

    base = Path(__file__).resolve().parent
    (base / "seed_data.sql").write_text(write_sql(companies, events), encoding="utf-8")
    write_registry(companies)
    write_invoice_edges(invoice_edges)

    print(
        f"seed_data.sql 已生成（{len(companies)} 家企业, "
        f"{len(events)} 条法律事件, {len(invoice_edges)} 条发票交易边）"
    )
    await import_to_db(companies, events)


if __name__ == "__main__":
    asyncio.run(main_async())
