from fastapi import APIRouter, HTTPException, Query

from app.services import graph_service

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/path")
async def industry_path(
    from_id: str = Query(..., alias="from", description="起始企业ID，如 ENT001"),
    to_id: str = Query(..., alias="to", description="目标企业ID，如 ENT005"),
):
    if not graph_service.is_data_loaded():
        raise HTTPException(status_code=404, detail="产业链数据未导入，请联系管理员")

    result = graph_service.find_industry_path(from_id, to_id)
    if not result:
        raise HTTPException(status_code=404, detail="未找到产业链路径或企业不存在")
    return result


@router.get("/key-companies")
async def key_companies(top_n: int = Query(20, ge=1, le=50)):
    if not graph_service.is_data_loaded():
        raise HTTPException(status_code=404, detail="产业链数据未导入，请联系管理员")
    return graph_service.get_key_companies(top_n)
