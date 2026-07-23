"""
存档端点

游戏存档的创建、读取、列表和删除。
每次新建存档都从模板复制，避免修改默认数据。
存档文件同时包含游戏数据和世界书数据。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.save_service import SaveService

router = APIRouter(tags=["存档"])


class SaveGameRequest(BaseModel):
    save_id: str
    data: dict
    worldbook_data: dict | None = None


class WorldbookSaveRequest(BaseModel):
    save_id: str
    worldbook_data: dict


@router.get("/saves")
async def list_saves():
    """列出所有存档"""
    return {"saves": SaveService.list_saves()}


@router.get("/saves/{save_id}")
async def load_save(save_id: str):
    """加载指定存档（含游戏数据和世界书数据）"""
    data = SaveService.get_save(save_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"存档不存在: {save_id}")
    return data


@router.post("/saves")
async def create_save(request: SaveGameRequest):
    """
    创建/更新存档。
    存档文件同时包含 game_data 和 worldbook_data。
    """
    data = request.data
    if request.worldbook_data is not None:
        data["worldbook_data"] = request.worldbook_data
    
    result = SaveService.save_game(request.save_id, data)
    return result


@router.post("/saves/{save_id}/from-template")
async def create_from_template(save_id: str):
    """从默认模板创建新存档"""
    data = SaveService.create_from_template(save_id)
    return {"success": True, "save_id": save_id, "data": data}


@router.delete("/saves/{save_id}")
async def delete_save(save_id: str):
    """删除存档"""
    success = SaveService.delete_save(save_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"存档不存在: {save_id}")
    return {"success": True}


@router.post("/saves/{save_id}/reset")
async def reset_save(save_id: str):
    """重置存档为模板"""
    data = SaveService.reset_to_template(save_id)
    return {"success": True, "save_id": save_id, "data": data}


# ======================== 存档内世界书端点 ========================

@router.get("/saves/{save_id}/worldbook")
async def get_save_worldbook(save_id: str):
    """从存档中获取世界书数据"""
    wb = SaveService.get_worldbook(save_id)
    if wb is None:
        raise HTTPException(status_code=404, detail=f"存档不存在: {save_id}")
    
    # 转换 entries 为数组格式（前端期望）
    entries = wb.get("entries", {})
    if isinstance(entries, dict) and not isinstance(entries, list):
        wb = {**wb, "entries": list(entries.values())}
    elif not isinstance(entries, list):
        wb = {**wb, "entries": []}
    
    return wb


@router.put("/saves/{save_id}/worldbook")
async def save_save_worldbook(save_id: str, request: WorldbookSaveRequest):
    """保存世界书数据到存档"""
    result = SaveService.save_worldbook(save_id, request.worldbook_data)
    return result
