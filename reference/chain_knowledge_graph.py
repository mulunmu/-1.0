"""
开源验证基准：ChainKnowledgeGraph 产业链知识图谱
GitHub: liuhuanyong/ChainKnowledgeGraph (729 stars)
数据规模：4654家A股 / 511行业 / 10万+节点 / 16万+边

实体类型：上市公司、行业、产品
关系类型：
  company_industry   → 上市公司所属行业
  industry_upstream  → 产品上游原材料关系
  industry_downstream → 产品下游产品关系
  company_product    → 公司主营产品

使用方法（直接导入NetworkX）：
  import json, networkx as nx
  G = nx.Graph()
  # 从JSON加载节点和边
  with open("company_industry.json") as f:
      for row in json.load(f):
          G.add_edge(row["company"], row["industry"], type="belongs_to")
  with open("product_product.json") as f:
      for row in json.load(f):
          G.add_edge(row["upstream"], row["downstream"], type="supply_chain")
"""

# 产业链传导路径示例
def find_industry_path(G, company_a, company_b):
    """查找两家企业在产业链中的关系路径"""
    import networkx as nx
    try:
        return nx.shortest_path(G, company_a, company_b)
    except nx.NetworkXNoPath:
        return None

# 关键节点识别（中心度算法）
def get_key_companies(G, top_n=20):
    """识别产业链中的关键节点企业"""
    import networkx as nx
    centrality = nx.betweenness_centrality(G)
    return sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:top_n]
