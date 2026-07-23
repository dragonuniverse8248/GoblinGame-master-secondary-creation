"""
图片服务端点 v2

适配新的目录结构：通用/大陆/索引.json
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from services.image_service import ImageService

router = APIRouter(tags=["图片"])


@router.get("/images/continents")
async def list_continents():
    """列出所有大陆及其图片统计"""
    continents = ImageService.list_continents()
    return {"continents": continents}


@router.get("/images/{continent}/index")
async def get_continent_index(continent: str):
    """获取大陆的索引文件"""
    index = ImageService.refresh_index(continent)
    return index


@router.post("/images/{continent}/refresh")
async def refresh_continent_index(continent: str):
    """刷新大陆索引"""
    index = ImageService.refresh_index(continent)
    return {"success": True, "index": index}


@router.get("/images/random/common")
async def get_random_common(continent: str | None = Query(None)):
    """随机获取通用图片（大陆优先，全局兜底）"""
    url = ImageService.get_common_image(continent)
    if not url:
        raise HTTPException(status_code=404, detail="无可用图片")
    return {"url": url}


@router.get("/images/assign/{character_id}")
async def assign_character_image(character_id: str, continent: str | None = Query(None)):
    """为角色分配图片（确定性）"""
    result = ImageService.assign_character_image(character_id, continent)
    return result


@router.get("/images/goblin-king")
async def get_goblin_king_image():
    """获取哥布林之王图片（直接返回图片文件）"""
    url = ImageService.get_goblin_king_image()
    if not url:
        raise HTTPException(status_code=404, detail="哥布林之王图片未配置")
    filepath = ImageService.get_images_dir() / url.lstrip("/images/")
    if filepath.exists():
        return FileResponse(str(filepath))
    raise HTTPException(status_code=404, detail="哥布林之王图片文件不存在")


@router.get("/images/broken-fallback")
async def broken_image_fallback():
    """图片加载失败兜底"""
    url = ImageService.get_common_image()
    if not url:
        raise HTTPException(status_code=404)
    filepath = ImageService.get_images_dir() / url.lstrip("/images/")
    if filepath.exists():
        return FileResponse(str(filepath))


@router.get("/images/export/{continent}")
async def export_continent_images(continent: str):
    """导出大陆图片数据"""
    data = ImageService.export_continent(continent)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


# ======================== 世界书模板端点 ========================

@router.get("/images/{continent}/full")
async def get_continent_full_data(continent: str):
    """
    获取大陆完整数据（传奇人物 + worldbook模板），用于写入存档世界书。
    """
    data = ImageService.get_continent_full_data(continent)
    return data


@router.post("/images/{continent}/worldbook")
async def set_continent_worldbook(continent: str, worldbook_data: dict):
    """设置大陆的 worldbook 模板数据"""
    ImageService.set_continent_worldbook_template(continent, worldbook_data)
    return {"success": True, "continent": continent}


@router.post("/images/{continent}/character/{character_name}/worldbook-uid")
async def set_character_worldbook_uid(continent: str, character_name: str, data: dict):
    """设置传奇人物的 worldbook_uid"""
    uid = data.get("worldbook_uid")
    if uid is None:
        raise HTTPException(status_code=400, detail="缺少 worldbook_uid")
    success = ImageService.set_character_worldbook_uid(continent, character_name, uid)
    if not success:
        raise HTTPException(status_code=404, detail=f"未找到角色: {character_name}")
    return {"success": True, "continent": continent, "character": character_name, "worldbook_uid": uid}


# ======================== 传奇人物 CRUD ========================

@router.post("/images/{continent}/character")
async def add_legendary_character(continent: str, char_data: dict):
    """添加或更新传奇角色（无需实际图片文件）"""
    name = char_data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="缺少角色名称")
    ImageService.add_legendary_character(continent, char_data)
    return {"success": True, "continent": continent, "character": name}


@router.put("/images/{continent}/character/{character_name}")
async def update_legendary_character(continent: str, character_name: str, char_data: dict):
    """更新传奇角色"""
    char_data["name"] = character_name  # 确保名称一致
    ImageService.add_legendary_character(continent, char_data)
    return {"success": True, "continent": continent, "character": character_name}


@router.delete("/images/{continent}/character/{character_name}")
async def delete_legendary_character(continent: str, character_name: str):
    """删除传奇角色"""
    success = ImageService.delete_legendary_character(continent, character_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"未找到角色: {character_name}")
    return {"success": True, "continent": continent, "character": character_name}
