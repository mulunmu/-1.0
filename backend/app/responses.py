import json

from fastapi.responses import JSONResponse


class UTF8JSONResponse(JSONResponse):
    """JSON 响应，UTF-8 编码且不转义中文"""

    media_type = "application/json; charset=utf-8"

    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False, default=str).encode("utf-8")
