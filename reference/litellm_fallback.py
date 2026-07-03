"""
开源验证基准：litellm 官方重试+降级模式
GitHub: BerriAI/litellm (40K+ stars)
文档：https://docs.litellm.ai/docs/completion/reliable_completions

这是litellm官方文档中的标准重试+降级模式，经过生产环境验证。
Cursor在修改 llm_reply.py 时必须参照这个模式。
"""

from litellm import completion

# ====== 模式1：简单重试（官方文档） ======
def generate_with_retry(messages):
    """失败自动重试3次"""
    return completion(
        model="glm-4-flash",
        messages=messages,
        num_retries=3,          # 官方参数，自动重试
        timeout=15,             # 15秒超时
        max_tokens=200,
        temperature=0.2,
    )


# ====== 模式2：多模型降级（官方文档） ======
def generate_with_fallback(messages):
    """主模型挂了自动切换备选"""
    return completion(
        model="glm-4-flash",       # 主模型
        messages=messages,
        fallbacks=["deepseek-chat"],  # 降级模型1
        # 可继续追加: "qwen-turbo", "hunyuan-lite"
        num_retries=2,
        timeout=15,
    )


# ====== 模式3：多级降级链（官方Router模式） ======
from litellm import Router

# 定义模型列表 + 降级链
router = Router(
    model_list=[
        {"model_name": "primary",   "litellm_params": {"model": "openai/glm-4-flash"}},
        {"model_name": "fallback1",  "litellm_params": {"model": "openai/deepseek-chat"}},
        {"model_name": "fallback2",  "litellm_params": {"model": "openai/qwen-turbo"}},
    ],
    fallbacks=[{"primary": ["fallback1", "fallback2"]}],
    num_retries=2,
)

def generate_robust(messages):
    """三级降级链：主模型→备选1→备选2→全部失败返回None"""
    try:
        return router.completion(model="primary", messages=messages)
    except Exception as e:
        print(f"All models failed: {e}")
        return None


# ====== 集成指南 ======
"""
在 llm_reply.py 中使用：

def generate_reply(intent, data):
    messages = [
        {"role": "system", "content": "你是企业风险分析助手，根据数据生成50-100字的中文分析。"},
        {"role": "user", "content": f"意图:{intent}\n数据:{data}"}
    ]
    try:
        resp = completion(
            model="glm-4-flash",
            messages=messages,
            fallbacks=["deepseek-chat"],
            num_retries=2,
            timeout=15,
            max_tokens=200,
        )
        return resp.choices[0].message.content
    except Exception:
        return template_reply(intent, data)  # 规则兜底
"""
