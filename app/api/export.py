"""
大陆导出端点

将大陆信息和对应的图片打包导出为 ZIP 文件。
导出内容包括：
- 大陆信息 JSON
- 英雄级图片
- 传说级图片
- 小兵级图片
"""
import io
import json
import zipfile
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Body, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse

from services.image_service import ImageService

router = APIRouter(tags=["导出"])
IMAGES_DIR = ImageService.get_images_dir()


@router.get("/export/continent")
async def export_continent(
    continent: str = Query(..., description="大陆名称"),
):
    """
    导出指定大陆的数据和图片
    
    返回一个 ZIP 文件，包含：
    - continent_info.json - 大陆基本信息
    - heroes/ - 英雄级图片
    - legendary/ - 传说级图片
    - soldiers/ - 小兵级图片
    """
    if not continent:
        raise HTTPException(status_code=400, detail="请指定大陆名称")
    
    # 获取大陆图片
    continent_images = ImageService.get_continent_images(continent)
    
    total_images = sum(len(v) for v in continent_images.values())
    if total_images == 0:
        raise HTTPException(
            status_code=404,
            detail=f"大陆 '{continent}' 没有任何图片，请先将图片放入对应目录",
        )
    
    # 创建 ZIP 文件
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 添加大陆信息
        continent_info = {
            "name": continent,
            "export_version": "1.0.0",
            "image_stats": {
                "heroes": len(continent_images.get("heroes", [])),
                "legendary": len(continent_images.get("legendary", [])),
                "soldiers": len(continent_images.get("soldiers", [])),
            },
        }
        zf.writestr("continent_info.json", json.dumps(continent_info, ensure_ascii=False, indent=2))
        
        # 添加各类图片
        for category, files in continent_images.items():
            for filepath in files:
                path = Path(filepath)
                if path.exists():
                    arcname = f"{category}/{path.name}"
                    zf.write(path, arcname)
    
    zip_buffer.seek(0)
    
    # 安全的文件名
    safe_filename = quote(f"{continent}_export.zip")
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        },
    )


@router.post("/export/continent")
async def export_continent_with_data(
    continent: str = Query(..., description="大陆名称"),
    continent_config: dict = Body(None, description="大陆配置JSON"),
):
    """
    导出大陆完整数据包（含配置、索引、图片）

    返回 ZIP 包含：
    - continent_config.json - 大陆完整配置
    - 索引.json - 传说人物索引
    - 传奇/ - 传奇人物图片
    - 通用/ - 小兵级图片
    - heroes/ - 英雄级图片（同传奇）
    """
    if not continent:
        raise HTTPException(status_code=400, detail="请指定大陆名称")

    continent_dir = IMAGES_DIR / continent

    # 获取图片
    continent_images = ImageService.get_continent_images(continent)

    # 创建 ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. 大陆配置
        if continent_config:
            zf.writestr(
                "continent_config.json",
                json.dumps(continent_config, ensure_ascii=False, indent=2),
            )
        else:
            zf.writestr(
                "continent_config.json",
                json.dumps({"name": continent, "export_version": "2.0.0"}, ensure_ascii=False, indent=2),
            )

        # 2. 索引文件（传说人物数据）
        index_path = continent_dir / "索引.json"
        if index_path.exists():
            zf.write(str(index_path), "索引.json")

        # 3. 各类图片（去重：heroes 和 legendary 指向同一目录）
        seen = set()
        for category, files in continent_images.items():
            if category == "heroes":
                continue  # heroes 和 legendary 重复，跳过
            for filepath in files:
                path = Path(filepath)
                if not path.exists():
                    continue
                if category in ("legendary",):
                    arcname = f"传奇/{path.name}"
                elif category == "soldiers":
                    arcname = f"通用/{path.name}"
                else:
                    arcname = f"{category}/{path.name}"
                if arcname in seen:
                    continue
                seen.add(arcname)
                zf.write(path, arcname)

    zip_buffer.seek(0)
    # URL 编码文件名避免 HTTP header 编码问题
    safe_filename = quote(f"{continent}_完整包.zip")

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        },
    )


# ======================== 导入端点 ========================

@router.post("/import/continent")
async def import_continent(
    file: UploadFile = File(..., description="大陆ZIP压缩包"),
):
    """
    导入大陆完整数据包

    接收 ZIP 文件，自动解压并部署：
    - 传奇图片 → images/{大陆}/传奇/
    - 通用图片 → images/{大陆}/通用/
    - 索引.json → images/{大陆}/索引.json
    返回 continent_config.json 内容供前端创建大陆
    """
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="请上传 .zip 格式的压缩包")

    # 读取ZIP
    zip_data = await file.read()
    zip_buffer = io.BytesIO(zip_data)

    continent_name = None
    continent_config = None

    with zipfile.ZipFile(zip_buffer, "r") as zf:
        # 1. 先读取大陆配置获取大陆名
        if "continent_config.json" in zf.namelist():
            config_data = json.loads(zf.read("continent_config.json").decode("utf-8"))
            continent_name = config_data.get("name", "")
            continent_config = config_data

        if not continent_name:
            raise HTTPException(status_code=400, detail="ZIP 中缺少 continent_config.json 或大陆名称")

        # 确保大陆目录存在
        continent_dir = IMAGES_DIR / continent_name
        continent_dir.mkdir(parents=True, exist_ok=True)
        (continent_dir / "传奇").mkdir(exist_ok=True)
        (continent_dir / "通用").mkdir(exist_ok=True)

        # 2. 部署图片文件
        for member in zf.namelist():
            if member.startswith("传奇/") and not member.endswith('/'):
                filename = Path(member).name
                target = continent_dir / "传奇" / filename
                with open(target, "wb") as f:
                    f.write(zf.read(member))
            elif member.startswith("通用/") and not member.endswith('/'):
                filename = Path(member).name
                target = continent_dir / "通用" / filename
                with open(target, "wb") as f:
                    f.write(zf.read(member))

        # 3. 部署索引文件
        if "索引.json" in zf.namelist():
            index_data = json.loads(zf.read("索引.json").decode("utf-8"))
            index_path = continent_dir / "索引.json"
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)

    # 刷新图片索引
    ImageService.refresh_index(continent_name)

    return {
        "success": True,
        "continent_name": continent_name,
        "continent_config": continent_config,
    }
