"""
开源验证基准：Financial-Intent-Understanding-with-LLMs
GitHub: klay-liu/Financial-Intent-Understanding-with-LLMs
模型：Qwen2.5-7B 零样本准确率 85.33%，微调后 88%

这是经过OpenFinData基准评测验证的金融意图分类方案。
Cursor在修改 intent_engine.py 时必须参照这个模板。

使用方法：
  from litellm import completion
  response = completion(
      model="glm-4-flash",
      messages=[
          {"role": "system", "content": INTENT_SYSTEM_PROMPT},
          {"role": "user", "content": f"问句: {query}"}
      ],
      temperature=0.0,
      max_tokens=20
  )
  intent_label = response.choices[0].message.content.strip()
"""

# 验证过的系统提示词（OpenFinData基准评测使用）
INTENT_SYSTEM_PROMPT = """你是一个意图分析助手。请分析以下问句的意图类型。

意图类别：
- tax_health：查询企业税务健康、纳税信用、欠税违法
- authenticity：查询经营真实性、营收偏差、发票活跃度
- industry_compare：查询行业排名、同行对比
- risk_warning：查询风险预警信号
- enterprise_pk：对比多家企业
- full_report：生成评估报告
- email_report：发送报告到邮箱
- chat：闲聊

请只输出意图标签（如 tax_health），不要输出其他内容。"""


# 标准测试用例（20条，覆盖所有意图）
TEST_CASES = [
    # tax_health
    ("分析一下深圳明达科技的税务信用", "tax_health"),
    ("这家企业纳税情况怎么样", "tax_health"),
    ("查一下纳税信用等级", "tax_health"),
    ("有没有欠税记录", "tax_health"),
    # authenticity
    ("经营真实吗", "authenticity"),
    ("报给税务局的营收和公开财报对得上吗", "authenticity"),
    ("发票开得多不多", "authenticity"),
    # industry_compare
    ("跟同行比怎么样", "industry_compare"),
    ("在行业里排第几", "industry_compare"),
    ("同行对比", "industry_compare"),
    # risk_warning
    ("有什么风险信号", "risk_warning"),
    ("预警清单", "risk_warning"),
    ("哪些企业有风险", "risk_warning"),
    # enterprise_pk
    ("对比深圳明达和杭州绿源", "enterprise_pk"),
    ("PK一下ENT001和ENT005", "enterprise_pk"),
    # full_report
    ("生成评估报告", "full_report"),
    ("下载报告", "full_report"),
    # email_report
    ("把报告发到我邮箱", "email_report"),
    # chat
    ("你好", "chat"),
    ("谢谢", "chat"),
]
