"""
图片管理服务 v2

新的目录结构：
images/
  通用/               ← 全局兜底图片（1.png, 2.png, ...）
    1.png
    2.png
  {大陆名}/            ← 每个大陆独立目录
    索引.json          ← 索引文件
    通用/              ← 大陆通用图片
      1.png
    传奇/              ← 传奇英雄图片
      角色名_1.png      ← 正常状态
      角色名_2.png      ← 腐化状态
      角色名_3.png      ← 完全腐化状态
  默认/                ← 默认大陆（兜底）
    索引.json
    通用/
    传奇/
    哥布林之王/
      哥布林之王.png
"""
import json
import os
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "images"

# 缓存索引数据
_index_cache: dict[str, dict] = {}
# 图片分配缓存（确保同一角色总是分配到同一图片）
_assignment_cache: dict[str, str] = {}


class ImageService:
    """图片管理服务 v2"""
    
    @classmethod
    def get_images_dir(cls) -> Path:
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        return IMAGES_DIR
    
    @classmethod
    def ensure_directories(cls):
        """确保所有必要的目录和索引文件存在"""
        dirs = ["通用", "默认/通用", "默认/传奇", "默认/哥布林之王"]
        for d in dirs:
            (IMAGES_DIR / d).mkdir(parents=True, exist_ok=True)
        cls._ensure_index("默认")
    
    @classmethod
    def _ensure_index(cls, continent: str):
        """确保索引文件存在"""
        index_path = IMAGES_DIR / continent / "索引.json"
        if not index_path.exists():
            default_index = {"通用": 0, "传奇": [], "worldbook": {}}
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(default_index, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def _load_index(cls, continent: str) -> dict:
        """加载索引文件（带缓存）"""
        if continent in _index_cache:
            return _index_cache[continent]
        
        index_path = IMAGES_DIR / continent / "索引.json"
        if index_path.exists():
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                _index_cache[continent] = data
                return data
            except (json.JSONDecodeError, IOError):
                pass
        
        data = {"通用": 0, "传奇": [], "worldbook": {}}
        _index_cache[continent] = data
        return data
    
    @classmethod
    def _save_index(cls, continent: str, data: dict):
        """保存索引文件"""
        index_path = IMAGES_DIR / continent / "索引.json"
        index_path.parent.mkdir(parents=True, exist_ok=True)
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        _index_cache[continent] = data
    
    @classmethod
    def _scan_images(cls, directory: Path) -> int:
        """扫描目录中的图片数量"""
        if not directory.exists():
            return 0
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
        return sum(1 for f in directory.iterdir() if f.suffix.lower() in extensions)
    
    @classmethod
    def refresh_index(cls, continent: str) -> dict:
        """刷新索引：扫描实际文件并更新索引"""
        continent_dir = IMAGES_DIR / continent
        common_dir = continent_dir / "通用"
        legendary_dir = continent_dir / "传奇"
        
        # 扫描通用图片数量
        common_count = cls._scan_images(common_dir)
        
        # 扫描传奇图片
        legendary_chars = []
        if legendary_dir.exists():
            import re
            # 按角色分组：xxx1.png / xxx_1.png → 角色名=xxx
            char_images: dict[str, list[str]] = {}
            extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
            for f in sorted(legendary_dir.iterdir()):
                if f.suffix.lower() in extensions:
                    stem = f.stem
                    # 去掉末尾的 _1/_2/_3 或 1/2/3（前面至少有一个非数字字符）
                    m = re.match(r'^(.+?)[_]?([123])$', stem)
                    if m and not stem.rstrip('123').rstrip('_').endswith(('_0','_4','_5','_6','_7','_8','_9')):
                        char_name = m.group(1)
                    else:
                        char_name = stem
                    if char_name not in char_images:
                        char_images[char_name] = []
                    char_images[char_name].append(f.name)
            
            # 读取已有索引中的角色背景信息
            existing_index = cls._load_index(continent)
            existing_legendary = existing_index.get("传奇", [])
            
            for char_name, images in char_images.items():
                # 尝试匹配已有索引（通过 images 文件名匹配）
                sorted_imgs = sorted(images)
                existing = None
                for el in existing_legendary:
                    el_imgs = set(el.get("images", []))
                    if el_imgs & set(sorted_imgs):
                        existing = el
                        break
                
                if existing:
                    # 使用已有的角色数据
                    legendary_chars.append({
                        "name": existing.get("name", char_name),
                        "title": existing.get("title", char_name),
                        "images": existing.get("images", sorted_imgs),
                        "worldbook_uid": existing.get("worldbook_uid", None),
                        "background": existing.get("background", ""),
                        "personality": existing.get("personality", []),
                        "race": existing.get("race", ""),
                        "identity": existing.get("identity", ""),
                    })
                elif len(sorted_imgs) == 1:
                    legendary_chars.append({
                        "name": char_name,
                        "title": char_name,
                        "images": sorted_imgs,
                        "worldbook_uid": None,
                        "background": "",
                        "personality": [],
                        "race": "",
                        "identity": "",
                    })
                else:
                    # 多张图但无索引匹配，创建默认条目
                    legendary_chars.append({
                        "name": char_name,
                        "title": char_name,
                        "images": sorted_imgs[:3] if len(sorted_imgs) >= 3 else sorted_imgs,
                        "worldbook_uid": None,
                        "background": "",
                        "personality": [],
                        "race": "",
                        "identity": "",
                    })
        
        index = {
            "通用": common_count,
            "传奇": legendary_chars if legendary_chars else existing_index.get("传奇", []),
            "worldbook": existing_index.get("worldbook", {}),
        }
        # 只在传奇角色有变化时才重写索引
        if legendary_chars:
            cls._save_index(continent, index)
        elif common_count != existing_index.get("通用", 0):
            # 仅通用图片数变化
            existing_index["通用"] = common_count
            cls._save_index(continent, existing_index)
            index = existing_index
        else:
            index = existing_index
        return index
    
    @classmethod
    def get_common_image(cls, continent: str | None = None) -> str | None:
        """
        获取一张通用图片
        
        优先从指定大陆的通用目录获取，若无则从全局通用目录获取。
        """
        # 先尝试大陆通用
        if continent:
            common_dir = IMAGES_DIR / continent / "通用"
            img = cls._random_from_dir(common_dir)
            if img:
                return f"/images/{continent}/通用/{img}"
        
        # 尝试默认通用
        default_common = IMAGES_DIR / "默认" / "通用"
        img = cls._random_from_dir(default_common)
        if img:
            return f"/images/默认/通用/{img}"
        
        # 全局通用
        global_common = IMAGES_DIR / "通用"
        img = cls._random_from_dir(global_common)
        if img:
            return f"/images/通用/{img}"
        
        return None
    
    @classmethod
    def _random_from_dir(cls, directory: Path) -> str | None:
        """从目录随机选取一张图片"""
        if not directory.exists():
            return None
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
        images = [f.name for f in directory.iterdir() if f.suffix.lower() in extensions]
        if not images:
            return None
        return random.choice(images)
    
    @classmethod
    def assign_character_image(cls, character_id: str, continent: str | None = None) -> dict:
        """
        为角色分配图片
        
        使用确定性分配（相同 character_id 总是得到相同图片），
        保证在存档内和重启后图片分配不变。
        """
        cache_key = f"{continent or 'default'}_{character_id}"
        if cache_key in _assignment_cache:
            return {"url": _assignment_cache[cache_key], "assigned": False}
        
        # 从大陆通用图片中分配
        if continent:
            common_dir = IMAGES_DIR / continent / "通用"
            img = cls._deterministic_pick(common_dir, character_id)
            if img:
                url = f"/images/{continent}/通用/{img}"
                _assignment_cache[cache_key] = url
                return {"url": url, "assigned": True}
        
        # 默认通用
        default_common = IMAGES_DIR / "默认" / "通用"
        img = cls._deterministic_pick(default_common, character_id)
        if img:
            url = f"/images/默认/通用/{img}"
            _assignment_cache[cache_key] = url
            return {"url": url, "assigned": True}
        
        # 全局通用兜底
        global_common = IMAGES_DIR / "通用"
        img = cls._deterministic_pick(global_common, character_id)
        if img:
            url = f"/images/通用/{img}"
            _assignment_cache[cache_key] = url
            return {"url": url, "assigned": True}
        
        return {"url": "", "assigned": False}
    
    @classmethod
    def _deterministic_pick(cls, directory: Path, seed: str) -> str | None:
        """确定性选取：相同 seed 总是返回相同图片（SHA256 保证均匀分布）"""
        if not directory.exists():
            return None
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
        images = sorted([f.name for f in directory.iterdir() if f.suffix.lower() in extensions])
        if not images:
            return None
        # 用 SHA256 确定性选取（比 Python hash() 分布更均匀）
        import hashlib
        hash_bytes = hashlib.sha256(seed.encode('utf-8')).digest()
        idx = int.from_bytes(hash_bytes[:4], 'big') % len(images)
        return images[idx]
    
    @classmethod
    def get_goblin_king_image(cls) -> str | None:
        """获取哥布林之王图片"""
        king_dir = IMAGES_DIR / "默认" / "哥布林之王"
        if not king_dir.exists():
            return None
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
        images = [f.name for f in king_dir.iterdir() if f.suffix.lower() in extensions]
        if images:
            return f"/images/默认/哥布林之王/{random.choice(images)}"
        return None
    
    @classmethod
    def list_continents(cls) -> list[dict]:
        """列出所有大陆及其图片统计"""
        continents = []
        for d in sorted(IMAGES_DIR.iterdir()):
            if not d.is_dir():
                continue
            if d.name in ("通用",):
                continue
            index = cls._load_index(d.name)
            index = cls.refresh_index(d.name)
            continents.append({
                "name": d.name,
                "common_count": index.get("通用", 0),
                "legendary_count": len(index.get("传奇", [])),
            })
        return continents
    
    @classmethod
    def get_continent_legendary(cls, continent: str) -> list[dict]:
        """获取大陆所有传奇角色"""
        index = cls._load_index(continent)
        index = cls.refresh_index(continent)
        return index.get("传奇", [])
    
    @classmethod
    def add_legendary_character(cls, continent: str, char_data: dict):
        """添加传奇角色到索引"""
        index = cls._load_index(continent)
        legendary = list(index.get("传奇", []))
        # 检查是否已存在
        existing_idx = next((i for i, c in enumerate(legendary) if c.get("name") == char_data.get("name")), -1)
        if existing_idx >= 0:
            # 保留已有的 worldbook_uid（如果新数据未提供）
            existing_wb_uid = legendary[existing_idx].get("worldbook_uid")
            if "worldbook_uid" not in char_data or char_data.get("worldbook_uid") is None:
                char_data["worldbook_uid"] = existing_wb_uid
            legendary[existing_idx] = char_data
        else:
            if "worldbook_uid" not in char_data:
                char_data["worldbook_uid"] = None
            legendary.append(char_data)
        index["传奇"] = legendary
        cls._save_index(continent, index)

    @classmethod
    def set_character_worldbook_uid(cls, continent: str, character_name: str, worldbook_uid: int):
        """更新传奇人物的 worldbook_uid（写入世界书后回调）"""
        index = cls._load_index(continent)
        legendary = list(index.get("传奇", []))
        for c in legendary:
            if c.get("name") == character_name:
                c["worldbook_uid"] = worldbook_uid
                cls._save_index(continent, index)
                return True
        return False
    
    @classmethod
    def get_continent_images(cls, continent: str) -> dict[str, list[str]]:
        """
        获取大陆的图片分类列表，用于导出 ZIP。

        返回 dict，键为类别名（heroes/legendary/soldiers），值为文件绝对路径列表。
        """
        continent_dir = IMAGES_DIR / continent
        result: dict[str, list[str]] = {"heroes": [], "legendary": [], "soldiers": []}
        extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

        if not continent_dir.exists():
            return result

        # 传奇图片
        legendary_dir = continent_dir / "传奇"
        if legendary_dir.exists():
            result["legendary"] = [
                str(f) for f in legendary_dir.iterdir() if f.suffix.lower() in extensions
            ]
            result["heroes"] = list(result["legendary"])

        # 通用图片（小兵）
        common_dir = continent_dir / "通用"
        if common_dir.exists():
            result["soldiers"] = [
                str(f) for f in common_dir.iterdir() if f.suffix.lower() in extensions
            ]

        return result

    @classmethod
    def delete_legendary_character(cls, continent: str, character_name: str) -> bool:
        """删除传奇角色"""
        index = cls._load_index(continent)
        legendary = list(index.get("传奇", []))
        new_legendary = [c for c in legendary if c.get("name") != character_name]
        if len(new_legendary) == len(legendary):
            return False  # 未找到
        index["传奇"] = new_legendary
        cls._save_index(continent, index)
        return True

    @classmethod
    def export_continent(cls, continent: str) -> dict:
        """导出大陆数据（用于备份/分享）"""
        continent_dir = IMAGES_DIR / continent
        if not continent_dir.exists():
            return {"error": f"大陆 '{continent}' 不存在"}
        
        index = cls.refresh_index(continent)
        # 收集所有图片路径
        images = []
        for sub in ["通用", "传奇"]:
            sub_dir = continent_dir / sub
            if sub_dir.exists():
                for f in sub_dir.iterdir():
                    if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}:
                        images.append(str(f.relative_to(IMAGES_DIR)))
        
        return {
            "name": continent,
            "index": index,
            "images": images,
        }
    
    @classmethod
    def import_continent(cls, continent: str, data: dict):
        """导入大陆数据（从备份/分享恢复）"""
        continent_dir = IMAGES_DIR / continent
        continent_dir.mkdir(parents=True, exist_ok=True)
        (continent_dir / "通用").mkdir(exist_ok=True)
        (continent_dir / "传奇").mkdir(exist_ok=True)
        
        # 保存索引
        if "index" in data:
            cls._save_index(continent, data["index"])
        
        return {"success": True, "continent": continent}

    # ======================== 世界书模板管理 ========================

    @classmethod
    def get_continent_worldbook_template(cls, continent: str) -> dict:
        """获取大陆索引中的 worldbook 模板数据"""
        index = cls._load_index(continent)
        return index.get("worldbook", {})

    @classmethod
    def set_continent_worldbook_template(cls, continent: str, worldbook_data: dict):
        """设置大陆索引中的 worldbook 模板数据"""
        index = cls._load_index(continent)
        index["worldbook"] = worldbook_data
        cls._save_index(continent, index)

    @classmethod
    def get_continent_full_data(cls, continent: str) -> dict:
        """
        获取大陆完整数据（传奇人物 + worldbook模板），用于写入存档世界书。
        先刷新索引确保数据最新。
        """
        index = cls.refresh_index(continent)
        return {
            "continent": continent,
            "common_count": index.get("通用", 0),
            "legendary": index.get("传奇", []),
            "worldbook": index.get("worldbook", {}),
        }
