"""
API 配置服务

管理 AI API 配置、游戏设置等，持久化到本地 JSON 文件。
支持：
- 多 API 配置管理
- 主流 API 一键配置（OpenAI、Anthropic、Google、DeepSeek 等）
- 生成参数调整（温度、Top-P、惩罚等）
- 自动获取模型列表
"""
import json
import os
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = DATA_DIR / "config"

# 主流 API 预设配置
API_PRESETS = {
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "models_url": "https://api.openai.com/v1/models",
        "requires_key": True,
        "default_model": "gpt-4o",
    },
    "anthropic": {
        "name": "Anthropic (Claude)",
        "base_url": "https://api.anthropic.com/v1",
        "models_url": None,  # Anthropic 使用不同的模型获取方式
        "requires_key": True,
        "default_model": "claude-sonnet-4-20250514",
    },
    "google": {
        "name": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "models_url": None,
        "requires_key": True,
        "default_model": "gemini-2.5-flash",
    },
    "deepseek": {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "models_url": "https://api.deepseek.com/v1/models",
        "requires_key": True,
        "default_model": "deepseek-chat",
    },
    "zhipu": {
        "name": "智谱 GLM",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "models_url": "https://open.bigmodel.cn/api/paas/v4/models",
        "requires_key": True,
        "default_model": "glm-4-flash",
    },
    "moonshot": {
        "name": "Moonshot (月之暗面)",
        "base_url": "https://api.moonshot.cn/v1",
        "models_url": "https://api.moonshot.cn/v1/models",
        "requires_key": True,
        "default_model": "moonshot-v1-8k",
    },
    "qwen": {
        "name": "通义千问 (DashScope)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models_url": None,
        "requires_key": True,
        "default_model": "qwen-plus",
    },
    "siliconflow": {
        "name": "SiliconFlow",
        "base_url": "https://api.siliconflow.cn/v1",
        "models_url": "https://api.siliconflow.cn/v1/models",
        "requires_key": True,
        "default_model": "Qwen/Qwen2.5-7B-Instruct",
    },
    "local": {
        "name": "本地模型 (Ollama/LocalAI)",
        "base_url": "http://localhost:11434/v1",
        "models_url": "http://localhost:11434/v1/models",
        "requires_key": False,
        "default_model": "llama3",
    },
}


class ConfigService:
    """配置管理服务"""
    
    @staticmethod
    def ensure_directories():
        """确保所有数据目录存在"""
        dirs = [
            DATA_DIR / "saves",
            CONFIG_DIR,
            DATA_DIR / "worldbook",
            DATA_DIR / "templates",
            BASE_DIR / "images" / "通用",
            BASE_DIR / "images" / "默认" / "通用",
            BASE_DIR / "images" / "默认" / "传奇",
            BASE_DIR / "images" / "默认" / "哥布林之王",
            BASE_DIR / "static",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)
        # 初始化图片索引
        try:
            from services.image_service import ImageService
            ImageService.ensure_directories()
        except Exception:
            pass
    
    # ======================== API 配置 ========================
    
    @staticmethod
    def _read_json(filepath: Path) -> dict:
        """读取 JSON 文件"""
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    @staticmethod
    def _write_json(filepath: Path, data: dict):
        """写入 JSON 文件"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def get_api_config_file() -> Path:
        return CONFIG_DIR / "api_config.json"
    
    @classmethod
    def get_api_config(cls) -> dict:
        """获取 API 配置"""
        default_config = {
            "current_config_id": "default",
            "configs": {
                "default": {
                    "id": "default",
                    "name": "默认配置",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "",
                    "model": "gpt-4o",
                    "temperature": 0.7,
                    "top_p": 1.0,
                    "top_k": 40,
                    "presence_penalty": 0.0,
                    "frequency_penalty": 0.0,
                    "max_tokens": 4096,
                    "enable_stream": True,
                }
            },
        }
        config = cls._read_json(cls.get_api_config_file())
        if not config:
            config = default_config
            cls._write_json(cls.get_api_config_file(), config)
        return config
    
    @classmethod
    def save_api_config(cls, config: dict):
        """保存 API 配置"""
        cls._write_json(cls.get_api_config_file(), config)
    
    @classmethod
    def get_current_api_config(cls) -> dict | None:
        """获取当前激活的 API 配置"""
        full_config = cls.get_api_config()
        current_id = full_config.get("current_config_id", "default")
        configs = full_config.get("configs", {})
        return configs.get(current_id)
    
    @classmethod
    def get_api_presets(cls) -> dict:
        """获取所有 API 预设"""
        return API_PRESETS
    
    # ======================== 游戏变量（替代 SillyTavern getVariables/replaceVariables）========================
    
    @staticmethod
    def get_game_variables_file() -> Path:
        return CONFIG_DIR / "game_variables.json"
    
    @classmethod
    def get_variables(cls, var_type: str = "global") -> dict:
        """获取游戏变量（替代 getVariables）"""
        if var_type == "global":
            return cls._read_json(cls.get_game_variables_file())
        # character / chat 等其他类型暂存内存
        return {}
    
    @classmethod
    def replace_variables(cls, variables: dict, var_type: str = "global"):
        """替换游戏变量（替代 replaceVariables）"""
        if var_type == "global":
            existing = cls._read_json(cls.get_game_variables_file())
            existing.update(variables)
            cls._write_json(cls.get_game_variables_file(), existing)
    
    # ======================== 游戏设置 ========================
    
    @staticmethod
    def get_game_settings_file() -> Path:
        return CONFIG_DIR / "game_settings.json"
    
    @classmethod
    def get_game_settings(cls) -> dict:
        """获取游戏设置"""
        default_settings = {
            "character_generation_format": "yaml",
            "enable_stream": True,
            "hero_generation_modifier": None,
            "enable_custom_api": False,
            "scout_prompt_template": "",
        }
        settings = cls._read_json(cls.get_game_settings_file())
        if not settings:
            settings = default_settings
            cls._write_json(cls.get_game_settings_file(), settings)
        return settings
    
    @classmethod
    def save_game_settings(cls, settings: dict):
        """保存游戏设置"""
        existing = cls.get_game_settings()
        existing.update(settings)
        cls._write_json(cls.get_game_settings_file(), existing)
