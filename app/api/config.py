"""
API 配置端点

管理：
- AI API 配置的增删改查
- 主流 API 一键配置
- 模型列表获取
- 游戏设置管理
- 全局变量读写（替代 getVariables/replaceVariables）
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_service import AIService
from services.config_service import ConfigService

router = APIRouter(tags=["配置"])


# ======================== 请求模型 ========================

class ApiConfigItem(BaseModel):
    id: str
    name: str = ""
    base_url: str = ""
    api_key: str = ""
    model: str = "gpt-4o"
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 40
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0
    max_tokens: int = 4096
    enable_stream: bool = True


class SaveApiConfigRequest(BaseModel):
    current_config_id: str = "default"
    configs: dict[str, ApiConfigItem] = {}


class TestConnectionRequest(BaseModel):
    base_url: str
    api_key: str = ""
    model: str = "gpt-4o"


class GameSettingsRequest(BaseModel):
    character_generation_format: str | None = None
    enable_stream: bool | None = None
    hero_generation_modifier: float | None = None
    enable_custom_api: bool | None = None
    scout_prompt_template: str | None = None


class VariablesRequest(BaseModel):
    """全局变量读写请求"""
    variables: dict
    type: str = "global"  # global / character / chat


class SingleVariableRequest(BaseModel):
    """单个变量读取请求"""
    type: str = "global"


# ======================== API 配置端点 ========================

@router.get("/config/api")
async def get_api_config():
    """获取完整 API 配置"""
    return ConfigService.get_api_config()


@router.post("/config/api")
async def save_api_config(request: SaveApiConfigRequest):
    """保存完整 API 配置"""
    config = {
        "current_config_id": request.current_config_id,
        "configs": {
            k: v.model_dump() for k, v in request.configs.items()
        },
    }
    ConfigService.save_api_config(config)
    return {"success": True}


@router.get("/config/api/current")
async def get_current_api_config():
    """获取当前激活的 API 配置"""
    config = ConfigService.get_current_api_config()
    if not config:
        raise HTTPException(status_code=404, detail="未找到激活的 API 配置")
    return config


@router.get("/config/api/presets")
async def get_api_presets():
    """获取主流 API 预设列表"""
    return ConfigService.get_api_presets()


@router.post("/config/api/presets/{preset_id}/apply")
async def apply_preset(preset_id: str):
    """一键应用 API 预设"""
    presets = ConfigService.get_api_presets()
    if preset_id not in presets:
        raise HTTPException(status_code=404, detail=f"未找到预设: {preset_id}")
    
    preset = presets[preset_id]
    
    full_config = ConfigService.get_api_config()
    config_id = preset_id
    
    full_config["configs"][config_id] = {
        "id": config_id,
        "name": preset["name"],
        "base_url": preset["base_url"],
        "api_key": "",
        "model": preset["default_model"],
        "temperature": 0.7,
        "top_p": 1.0,
        "top_k": 40,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
        "max_tokens": 4096,
        "enable_stream": True,
    }
    full_config["current_config_id"] = config_id
    ConfigService.save_api_config(full_config)
    
    return {"success": True, "message": f"已切换到 {preset['name']} 预设"}


@router.post("/config/api/test")
async def test_connection(request: TestConnectionRequest):
    """测试 API 连接"""
    config = {
        "base_url": request.base_url,
        "api_key": request.api_key,
        "model": request.model,
    }
    return await AIService.test_connection(config)


@router.get("/config/api/models")
async def fetch_models():
    """获取可用模型列表"""
    models = await AIService.fetch_models()
    return {"models": models}


@router.post("/config/api/models/fetch")
async def fetch_models_with_config(request: TestConnectionRequest):
    """使用指定配置获取模型列表"""
    config = {
        "base_url": request.base_url,
        "api_key": request.api_key,
        "model": request.model,
    }
    models = await AIService.fetch_models(config)
    return {"models": models}


# ======================== 游戏设置端点 ========================

@router.get("/config/game")
async def get_game_settings():
    """获取游戏设置"""
    return ConfigService.get_game_settings()


@router.post("/config/game")
async def save_game_settings(request: GameSettingsRequest):
    """保存游戏设置"""
    settings = {k: v for k, v in request.model_dump().items() if v is not None}
    ConfigService.save_game_settings(settings)
    return {"success": True}


# ======================== 全局变量端点（替代 getVariables/replaceVariables）========================

@router.post("/variables/get")
async def get_variables(request: SingleVariableRequest):
    """获取变量（替代 SillyTavern getVariables）"""
    return ConfigService.get_variables(request.type)


@router.post("/variables/replace")
async def replace_variables(request: VariablesRequest):
    """替换变量（替代 SillyTavern replaceVariables）"""
    ConfigService.replace_variables(request.variables, request.type)
    return {"success": True}
