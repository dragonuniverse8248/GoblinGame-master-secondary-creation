"""
世界书端点

替代 SillyTavern 世界书 API。
管理游戏设定、人物档案、剧情记录等世界书条目。
"""
import json
import re
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
WORLDBOOK_DIR = BASE_DIR / "data" / "worldbook"

router = APIRouter(tags=["世界书"])


class WorldbookEntry(BaseModel):
    uid: int
    key: list = []
    keysecondary: list = []
    comment: str = ""
    content: str = ""
    constant: bool = False
    selective: bool = True
    selectiveLogic: int = 0
    order: int = 100
    position: int = 1
    disable: bool = False
    probability: int = 100
    depth: int = 4
    extensions: dict = {}


class WorldbookData(BaseModel):
    name: str
    entries: dict[str, WorldbookEntry] = {}


# ======================== 游戏设定世界书（从原始 JSON 加载）========================

GAME_SETTINGS_WORLDBOOK = None


def _load_game_settings():
    """加载游戏设定 JSON"""
    global GAME_SETTINGS_WORLDBOOK
    
    if GAME_SETTINGS_WORLDBOOK is not None:
        return GAME_SETTINGS_WORLDBOOK
    
    # 优先从模板加载（模板是唯一可信源），若无则从 worldbook 目录加载
    paths = [
        BASE_DIR / "data" / "templates" / "default_worldbook.json",  # 🆕 模板（优先）
        BASE_DIR / "data" / "worldbook" / "哥布林巢穴-游戏设定.json",  # 兼容旧路径
        BASE_DIR.parent / "哥布林巢穴-游戏设定.json",  # 原始位置
    ]
    
    for path in paths:
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    GAME_SETTINGS_WORLDBOOK = json.load(f)
                print(f"✅ 已加载游戏设定: {path}")
                return GAME_SETTINGS_WORLDBOOK
            except (json.JSONDecodeError, IOError) as e:
                print(f"⚠️ 加载游戏设定失败 ({path}): {e}")
    
    # 返回空数据结构
    GAME_SETTINGS_WORLDBOOK = {"name": "哥布林巢穴-游戏设定", "entries": {}}
    return GAME_SETTINGS_WORLDBOOK


# ======================== 端点 ========================

@router.get("/worldbook")
async def list_worldbooks():
    """列出所有世界书"""
    # 加载游戏设定
    game_settings = _load_game_settings()
    
    # 列出数据库中的其他世界书
    dynamic_books = []
    WORLDBOOK_DIR.mkdir(parents=True, exist_ok=True)
    for f in WORLDBOOK_DIR.glob("*.json"):
        if f.name == "哥布林巢穴-游戏设定.json":
            continue
        dynamic_books.append(f.stem)
    
    return {
        "worldbooks": [
            {
                "name": game_settings.get("name", "哥布林巢穴-游戏设定"),
                "entry_count": len(game_settings.get("entries", {})),
                "type": "static",  # 静态游戏设定
            }
        ] + [
            {
                "name": name,
                "type": "dynamic",  # 动态生成的世界书
            }
            for name in dynamic_books
        ]
    }


@router.get("/worldbook/{name}")
async def get_worldbook(name: str):
    """
    获取指定世界书内容
    
    替代 TavernHelper.getWorldbook(name)
    """
    # 游戏设定世界书
    game_settings = _load_game_settings()
    if game_settings.get("name") == name or name == "哥布林巢穴-游戏设定":
        return game_settings
    
    # 动态世界书
    filepath = WORLDBOOK_DIR / f"{name}.json"
    if filepath.exists():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            raise HTTPException(status_code=500, detail="世界书文件损坏")
    
    raise HTTPException(status_code=404, detail=f"世界书不存在: {name}")


@router.put("/worldbook/{name}")
async def replace_worldbook(name: str, data: WorldbookData):
    """
    替换世界书内容
    
    替代 TavernHelper.replaceWorldbook(name, data)
    """
    # 如果是游戏设定，不允许直接替换（只允许更新动态世界书）
    game_settings = _load_game_settings()
    if game_settings.get("name") == name or name == "哥布林巢穴-游戏设定":
        raise HTTPException(status_code=403, detail="游戏设定世界书不可直接替换，请使用动态世界书")
    
    WORLDBOOK_DIR.mkdir(parents=True, exist_ok=True)
    filepath = WORLDBOOK_DIR / f"{name}.json"
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data.model_dump(), f, ensure_ascii=False, indent=2)
    
    return {"success": True, "name": name}


@router.post("/worldbook/{name}")
async def create_worldbook(name: str, data: WorldbookData | None = None):
    """
    创建世界书
    
    替代 TavernHelper.createWorldbook(name, entries)
    """
    WORLDBOOK_DIR.mkdir(parents=True, exist_ok=True)
    filepath = WORLDBOOK_DIR / f"{name}.json"
    
    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"世界书已存在: {name}")
    
    book_data = data.model_dump() if data else {"name": name, "entries": {}}
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(book_data, f, ensure_ascii=False, indent=2)
    
    return {"success": True, "name": name}


@router.delete("/worldbook/{name}")
async def delete_worldbook(name: str):
    """删除动态世界书"""
    # 不允许删除游戏设定
    game_settings = _load_game_settings()
    if game_settings.get("name") == name or name == "哥布林巢穴-游戏设定":
        raise HTTPException(status_code=403, detail="游戏设定世界书不可删除")
    
    filepath = WORLDBOOK_DIR / f"{name}.json"
    if filepath.exists():
        filepath.unlink()
        return {"success": True}
    
    raise HTTPException(status_code=404, detail=f"世界书不存在: {name}")


# ======================== 模板世界书搜索 ========================

# 大陆名称到 YAML 路径的映射（用于在模板世界书的大陆设定中搜索）
CONTINENT_YAML_PATH_MAP = {
    "世界树圣域": ["特拉希尔世界", "中央", "世界树圣域"],
    "瓦尔基里大陆": ["特拉希尔世界", "北部", "瓦尔基里大陆"],
    "香草群岛": ["特拉希尔世界", "南部", "香草群岛"],
    "赛菲亚大陆": ["特拉希尔世界", "西部", "赛菲亚大陆"],
    "古拉尔大陆": ["特拉希尔世界", "东部", "古拉尔大陆"],
}


def _extract_continent_yaml_section(yaml_content: str, continent_name: str) -> dict | None:
    """
    从模板世界书的大陆设定 YAML 中提取指定大陆的设定内容。

    返回包含大陆设定的字典，或 None。
    """
    try:
        # 去掉 YAML 代码块标记
        cleaned = yaml_content
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```\w*\n', '', cleaned)
            cleaned = re.sub(r'\n```$', '', cleaned)

        # 修复非标准 YAML：第一行 "特拉希尔世界: 描述文字" 同时有值和子键
        cleaned = re.sub(
            r'^(特拉希尔世界):\s*.*$',
            r'\1:',
            cleaned,
            flags=re.MULTILINE
        )

        data = yaml.safe_load(cleaned)
        if not data:
            return None

        world_data = data.get("特拉希尔世界", data)

        # 尝试通过路径映射查找
        path = CONTINENT_YAML_PATH_MAP.get(continent_name)
        if path:
            current = world_data
            direction = path[1]  # e.g. "东部"
            if direction in current and isinstance(current[direction], dict):
                continent_data = current[direction].get(continent_name)
                # 如果大陆名对应的值是 None（YAML 中与子键同级），
                # 则收集所有同级键作为大陆数据
                if continent_data is None:
                    # 大陆名只是一个分隔标记，收集同级键作为数据
                    siblings = current[direction]
                    continent_data = {
                        k: v for k, v in siblings.items()
                        if k != continent_name
                    }
                elif isinstance(continent_data, str):
                    # 大陆名对应描述字符串，同级还有更多数据
                    siblings = current[direction]
                    continent_data = {
                        "描述": continent_data,
                        **{k: v for k, v in siblings.items()
                           if k != continent_name}
                    }
                if isinstance(continent_data, dict) and continent_data:
                    return continent_data

        # 回退：在所有方向中搜索大陆名称
        for direction in ["中央", "北部", "南部", "西部", "东部"]:
            if direction in world_data and isinstance(world_data[direction], dict):
                dir_data = world_data[direction]
                if continent_name in dir_data:
                    continent_data = dir_data[continent_name]
                    if continent_data is None:
                        continent_data = {
                            k: v for k, v in dir_data.items()
                            if k != continent_name
                        }
                    elif isinstance(continent_data, str):
                        continent_data = {
                            "描述": continent_data,
                            **{k: v for k, v in dir_data.items()
                               if k != continent_name}
                        }
                    if isinstance(continent_data, dict) and continent_data:
                        return continent_data

        return None
    except Exception as e:
        print(f"⚠️ 解析大陆设定 YAML 失败: {e}")
        return None


def _search_template_for_continent(continent_name: str) -> list[dict]:
    """
    在模板世界书中搜索与指定大陆相关的所有条目。

    返回世界书条目列表，每个条目是一个 dict。
    """
    game_settings = _load_game_settings()
    entries = game_settings.get("entries", {})
    results = []

    for uid, entry in entries.items():
        content = entry.get("content", "")
        comment = entry.get("comment", "")
        keys = entry.get("key", [])
        keysecondary = entry.get("keysecondary", [])

        # 检查 content、comment、keys 中是否包含大陆名称
        search_text = f"{content} {comment} {' '.join(keys)} {' '.join(keysecondary)}"
        if continent_name in search_text:
            results.append(entry)

    return results


@router.get("/worldbook/template/continent/{continent_name}")
async def get_template_continent_setting(continent_name: str):
    """
    从模板世界书中搜索指定大陆的设定内容。

    返回：
    - continent_setting: 大陆设定 YAML 中提取的大陆描述
    - matched_entries: 模板中匹配该大陆名称的所有世界书条目
    """
    game_settings = _load_game_settings()
    entries = game_settings.get("entries", {})

    # 1. 从 uid=1 大陆设定中提取该大陆的描述
    continent_entry = entries.get("1", {})
    continent_setting = None
    yaml_raw = continent_entry.get("content", "")
    if yaml_raw:
        continent_section = _extract_continent_yaml_section(yaml_raw, continent_name)
        if continent_section:
            continent_setting = continent_section

    # 2. 搜索模板中所有匹配该大陆的条目
    matched_entries = _search_template_for_continent(continent_name)

    return {
        "continent_name": continent_name,
        "continent_setting": continent_setting,
        "matched_entries": matched_entries,
        "matched_count": len(matched_entries),
    }
