"""
存档服务

基于本地文件的游戏存档管理。采用模板机制：
- data/templates/ 存放不可变的默认模板
- data/saves/ 存放用户存档（从模板复制而来）
- 每个存档文件同时包含游戏数据和世界书数据
"""
import json
import shutil
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SAVES_DIR = BASE_DIR / "data" / "saves"
TEMPLATES_DIR = BASE_DIR / "data" / "templates"

DEFAULT_SAVE_TEMPLATE = TEMPLATES_DIR / "default_save.json"
DEFAULT_WORLDBOOK_TEMPLATE = TEMPLATES_DIR / "default_worldbook.json"


class SaveService:
    """存档管理服务"""
    
    MAX_SAVES = 10
    
    @classmethod
    def ensure_dirs(cls):
        """确保所有目录存在，并初始化默认模板"""
        SAVES_DIR.mkdir(parents=True, exist_ok=True)
        TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
        cls._ensure_templates()
    
    @classmethod
    def _ensure_templates(cls):
        """确保默认模板文件存在"""
        # 默认存档模板
        if not DEFAULT_SAVE_TEMPLATE.exists():
            default_save = {
                "metadata": {
                    "save_id": "__template__",
                    "saved_at": datetime.now().isoformat(),
                    "version": "2.0.0",
                    "is_template": True,
                },
                "game_data": {
                    "baseResources": {
                        "gold": 1000, "food": 1000, "threat": 0,
                        "slaves": 0, "trainingSlaves": 1, "rounds": 0,
                        "actionPoints": 3, "maxActionPoints": 3,
                        "conqueredRegions": 0,
                        "normalGoblins": 5, "warriorGoblins": 2,
                        "shamanGoblins": 0, "paladinGoblins": 0,
                    },
                    "exploration": {"locations": [], "continents": [], "state": {"scoutedLocations": [], "conqueredLocations": []}},
                    "nest": {},
                    "history": {"roundHistory": [], "maxHistoryEntries": 100},
                    "training": {"characters": [], "trainingMessages": []},
                    "formation": {"currentFormation": [None, None, None, None, None, None]},
                    "metadata": {
                        "gameVersion": "1.0.0",
                        "lastSaved": datetime.now().isoformat(),
                        "totalPlayTime": 0,
                        "gameStartTime": datetime.now().isoformat(),
                    },
                },
                "worldbook_data": {"name": "哥布林巢穴-人物档案", "entries": []},
            }
            with open(DEFAULT_SAVE_TEMPLATE, "w", encoding="utf-8") as f:
                json.dump(default_save, f, ensure_ascii=False, indent=2)
        
        # 默认世界书模板 — 从游戏设定 JSON 复制
        game_settings = BASE_DIR / "data" / "worldbook" / "哥布林巢穴-游戏设定.json"
        if not DEFAULT_WORLDBOOK_TEMPLATE.exists() and game_settings.exists():
            shutil.copy(game_settings, DEFAULT_WORLDBOOK_TEMPLATE)
    
    @classmethod
    def list_saves(cls) -> list[dict]:
        """列出所有存档"""
        cls.ensure_dirs()
        saves = []
        for f in sorted(SAVES_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                stat = f.stat()
                saves.append({
                    "id": f.stem,
                    "name": f.stem.replace("_", " "),
                    "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size": stat.st_size,
                })
            except OSError:
                pass
        return saves
    
    @classmethod
    def get_save(cls, save_id: str) -> dict | None:
        """获取指定存档"""
        cls.ensure_dirs()
        filepath = SAVES_DIR / f"{save_id}.json"
        if not filepath.exists():
            return None
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    
    @classmethod
    def create_from_template(cls, save_id: str) -> dict:
        """
        从默认模板创建新存档
        
        每次新建存档都从模板复制，避免修改默认数据。
        """
        cls.ensure_dirs()
        
        # 从模板复制
        if DEFAULT_SAVE_TEMPLATE.exists():
            with open(DEFAULT_SAVE_TEMPLATE, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {
                "metadata": {"save_id": save_id, "version": "2.0.0", "is_template": False},
                "game_data": {},
                "worldbook_data": {"name": "哥布林巢穴-人物档案", "entries": []},
            }
        
        # 移除模板标记
        data["metadata"]["save_id"] = save_id
        data["metadata"]["saved_at"] = datetime.now().isoformat()
        data["metadata"]["is_template"] = False
        
        # 保存到存档文件
        filepath = SAVES_DIR / f"{save_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return data
    
    @classmethod
    def save_game(cls, save_id: str, data: dict) -> dict:
        """
        保存游戏数据
        
        存档文件同时包含 game_data 和 worldbook_data。
        """
        cls.ensure_dirs()
        filepath = SAVES_DIR / f"{save_id}.json"
        
        now = datetime.now().isoformat()
        
        # 读取现有存档以保留 worldbook_data（如果 data 中没有提供）
        existing = None
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        
        worldbook_data = data.get("worldbook_data")
        if worldbook_data is None and existing:
            worldbook_data = existing.get("worldbook_data")
        
        save_data = {
            "metadata": {
                "save_id": save_id,
                "saved_at": now,
                "version": "2.0.0",
            },
            "game_data": data.get("game_data", data),
            "worldbook_data": worldbook_data or {"name": "哥布林巢穴-人物档案", "entries": []},
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)
        
        cls._cleanup_old_saves()
        
        return {"success": True, "save_id": save_id, "saved_at": now}
    
    @classmethod
    def save_worldbook(cls, save_id: str, worldbook_data: dict) -> dict:
        """单独保存世界书数据（合并到存档文件中）"""
        cls.ensure_dirs()
        filepath = SAVES_DIR / f"{save_id}.json"
        
        if filepath.exists():
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = cls.create_from_template(save_id)
        
        data["worldbook_data"] = worldbook_data
        data["metadata"]["saved_at"] = datetime.now().isoformat()
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "save_id": save_id}
    
    @classmethod
    def get_worldbook(cls, save_id: str) -> dict | None:
        """从存档中获取世界书数据"""
        save = cls.get_save(save_id)
        if save:
            return save.get("worldbook_data")
        return None
    
    @classmethod
    def delete_save(cls, save_id: str) -> bool:
        """删除存档"""
        cls.ensure_dirs()
        filepath = SAVES_DIR / f"{save_id}.json"
        if filepath.exists():
            filepath.unlink()
            return True
        return False
    
    @classmethod
    def reset_to_template(cls, save_id: str) -> dict:
        """将存档重置为模板（删除后重新从模板创建）"""
        cls.delete_save(save_id)
        return cls.create_from_template(save_id)
    
    @classmethod
    def _cleanup_old_saves(cls):
        """清理超出限制的旧存档"""
        saves = sorted(SAVES_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime)
        while len(saves) > cls.MAX_SAVES:
            try:
                saves[0].unlink()
                saves.pop(0)
            except OSError:
                break
