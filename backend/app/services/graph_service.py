"""产业链知识图谱（Reference: ChainKnowledgeGraph / reference/chain_knowledge_graph.py）"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import networkx as nx

ENTERPRISE_INDUSTRY: dict[str, str] = {
    "ENT001": "制造业",
    "ENT002": "批发零售",
    "ENT003": "信息技术",
    "ENT004": "制造业",
    "ENT005": "新能源",
    "ENT006": "物流",
    "ENT007": "医药",
    "ENT008": "建筑业",
    "ENT009": "交通运输",
    "ENT010": "餐饮",
}

ENTERPRISE_NAMES: dict[str, str] = {
    "ENT001": "深圳明达科技有限公司",
    "ENT002": "上海恒信贸易集团",
    "ENT003": "北京智云信息技术有限公司",
    "ENT004": "广州华南制造股份有限公司",
    "ENT005": "杭州绿源新能源科技",
    "ENT006": "成都天府物流有限公司",
    "ENT007": "武汉光谷生物医药",
    "ENT008": "南京金陵建筑工程",
    "ENT009": "天津滨海港口服务",
    "ENT010": "重庆山城餐饮连锁",
}

# 模拟企业一级行业 → ChainKnowledgeGraph 行业节点
MOCK_INDUSTRY_MAP: dict[str, str] = {
    "制造业": "专用设备",
    "批发零售": "贸易Ⅲ",
    "信息技术": "IT服务Ⅲ",
    "新能源": "锂电池",
    "物流": "公路货运",
    "医药": "化学制剂",
    "建筑业": "房屋建设Ⅲ",
    "交通运输": "港口",
    "餐饮": "休闲食品",
}

ROOT_NODE = "国民经济"


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _graph_data_dir() -> Path:
    return _project_root() / "opensource" / "ChainKnowledgeGraph-main" / "data"


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _add_industry_node(G: nx.Graph, name: str) -> None:
    if name and name not in G:
        G.add_node(name, node_type="industry", label=name)


@lru_cache(maxsize=1)
def _build_graph() -> tuple[nx.Graph, bool]:
    """构建产业链图谱，返回 (图, 数据是否成功加载)"""
    G = nx.Graph()
    data_dir = _graph_data_dir()
    company_file = data_dir / "company_industry.json"
    industry_file = data_dir / "industry_industry.json"
    upstream_file = data_dir / "industry_up.json"

    if not data_dir.exists() or not company_file.exists():
        return G, False

    loaded = False

    # 行业层级：子行业 → 上级行业
    for row in _load_jsonl(industry_file):
        child = row.get("from_industry")
        parent = row.get("to_industry")
        if child and parent:
            _add_industry_node(G, child)
            _add_industry_node(G, parent)
            G.add_edge(child, parent, rel="upstream")
            loaded = True

    # 行业上下游关联
    for row in _load_jsonl(upstream_file):
        industry = row.get("industry")
        ups = row.get("ups") or {}
        if not industry:
            continue
        _add_industry_node(G, industry)
        for up_name in ups:
            _add_industry_node(G, up_name)
            G.add_edge(industry, up_name, rel="supply_chain")
        loaded = True

    # 上市公司 → 行业（抽样加载，控制图规模）
    for i, row in enumerate(_load_jsonl(company_file)):
        if i >= 2000:
            break
        company = row.get("company_name")
        industry = row.get("industry_name")
        if company and industry:
            cid = f"CKG:{company}"
            G.add_node(cid, node_type="listed_company", label=company)
            _add_industry_node(G, industry)
            G.add_edge(cid, industry, rel="belongs_to")
            loaded = True

    # 虚拟根节点
    G.add_node(ROOT_NODE, node_type="root", label=ROOT_NODE)

    known_industries = {n for n, d in G.nodes(data=True) if d.get("node_type") == "industry"}

    # 映射 10 家模拟企业
    for eid, mock_industry in ENTERPRISE_INDUSTRY.items():
        G.add_node(eid, node_type="enterprise", label=ENTERPRISE_NAMES.get(eid, eid))
        mock_node = f"mock:{mock_industry}"
        _add_industry_node(G, mock_node)
        G.add_edge(eid, mock_node, rel="belongs_to")

        mapped = MOCK_INDUSTRY_MAP.get(mock_industry, mock_industry)
        if mapped in known_industries:
            G.add_edge(mock_node, mapped, rel="maps_to")
        elif mapped in G:
            G.add_edge(mock_node, mapped, rel="maps_to")
        else:
            _add_industry_node(G, mapped)
            G.add_edge(mock_node, mapped, rel="maps_to")

        G.add_edge(mock_node, ROOT_NODE, rel="sector_root")

    # 同行业样本企业互联
    by_industry: dict[str, list[str]] = {}
    for eid, ind in ENTERPRISE_INDUSTRY.items():
        by_industry.setdefault(ind, []).append(eid)
    for peers in by_industry.values():
        for i, a in enumerate(peers):
            for b in peers[i + 1 :]:
                G.add_edge(a, b, rel="same_industry")

    return G, loaded


def is_data_loaded() -> bool:
    _, loaded = _build_graph()
    return loaded


def find_path(company_a: str, company_b: str) -> dict | None:
    """查找两家企业在产业链图谱中的最短路径"""
    return find_industry_path(company_a, company_b)


def find_industry_path(company_a: str, company_b: str) -> dict | None:
    G, loaded = _build_graph()
    if not loaded:
        return None

    a, b = company_a.upper(), company_b.upper()
    if a not in G or b not in G:
        return None
    try:
        path = nx.shortest_path(G, a, b)
    except nx.NetworkXNoPath:
        return None

    nodes = []
    for node in path:
        attrs = G.nodes[node]
        ntype = attrs.get("node_type", "industry")
        if node in ENTERPRISE_NAMES:
            nodes.append({"id": node, "type": "enterprise", "name": ENTERPRISE_NAMES[node]})
        elif ntype == "listed_company":
            nodes.append({"id": node, "type": "listed_company", "name": attrs.get("label", node)})
        elif node == ROOT_NODE:
            nodes.append({"id": node, "type": "root", "name": ROOT_NODE})
        else:
            label = attrs.get("label", str(node).replace("mock:", ""))
            nodes.append({"id": node, "type": ntype, "name": label})

    return {
        "from": a,
        "to": b,
        "path": path,
        "nodes": nodes,
        "length": len(path) - 1,
    }


def get_centrality(top_n: int = 10) -> list[dict]:
    """计算 10 家样本企业的介数中心度排名"""
    return get_key_companies(top_n)


def get_key_companies(top_n: int = 20) -> list[dict]:
    G, loaded = _build_graph()
    if not loaded:
        return []

    centrality = nx.betweenness_centrality(G)
    enterprise_scores = [
        (node, score)
        for node, score in centrality.items()
        if node.startswith("ENT")
    ]
    enterprise_scores.sort(key=lambda x: x[1], reverse=True)
    return [
        {
            "enterprise_id": eid,
            "enterprise_name": ENTERPRISE_NAMES.get(eid, eid),
            "industry": ENTERPRISE_INDUSTRY.get(eid),
            "centrality": round(score, 4),
            "rank": i + 1,
        }
        for i, (eid, score) in enumerate(enterprise_scores[:top_n])
    ]
