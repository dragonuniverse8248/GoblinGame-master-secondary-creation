"""
AI 生成代理服务

代理 AI 文本生成请求到配置的 API 后端。
支持：
- OpenAI 兼容 API
- 流式和非流式生成
- 自动重试
"""
import json
import time
from typing import AsyncGenerator

import httpx

from services.config_service import ConfigService


class AIService:
    """AI 文本生成代理"""
    
    @classmethod
    def _build_payload(cls, messages: list, config: dict) -> dict:
        """构建 API 请求 payload"""
        payload = {
            "model": config.get("model", "gpt-4o"),
            "messages": messages,
            "temperature": config.get("temperature", 0.7),
            "top_p": config.get("top_p", 1.0),
            "presence_penalty": config.get("presence_penalty", 0.0),
            "frequency_penalty": config.get("frequency_penalty", 0.0),
            "max_tokens": config.get("max_tokens", 4096),
        }
        return payload
    
    @classmethod
    def _get_headers(cls, config: dict) -> dict:
        """构建请求头"""
        headers = {"Content-Type": "application/json"}
        api_key = config.get("api_key", "")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers
    
    @classmethod
    async def generate(cls, messages: list, options: dict | None = None) -> str:
        """
        非流式文本生成
        
        Args:
            messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
            options: 可选覆盖参数（如 custom_api 配置）
        
        Returns:
            生成的文本
        """
        config = cls._resolve_config(options)
        payload = cls._build_payload(messages, config)
        base_url = config.get("base_url", "https://api.openai.com/v1")
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = cls._get_headers(config)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # 提取生成的文本
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return ""
    
    @classmethod
    async def generate_stream(cls, messages: list, options: dict | None = None) -> AsyncGenerator[str, None]:
        """
        流式文本生成
        
        Yields:
            每次 yield 一段生成的文本增量
        """
        config = cls._resolve_config(options)
        payload = cls._build_payload(messages, config)
        payload["stream"] = True
        base_url = config.get("base_url", "https://api.openai.com/v1")
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = cls._get_headers(config)
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
    
    @classmethod
    async def test_connection(cls, config: dict) -> dict:
        """测试 API 连接"""
        try:
            base_url = config.get("base_url", "https://api.openai.com/v1")
            url = f"{base_url.rstrip('/')}/chat/completions"
            headers = cls._get_headers(config)
            
            test_payload = {
                "model": config.get("model", "gpt-4o"),
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5,
            }
            
            start_time = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=test_payload, headers=headers)
                elapsed = time.time() - start_time
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": f"连接成功！延迟: {elapsed:.2f}秒",
                        "latency": round(elapsed, 2),
                    }
                else:
                    error_detail = ""
                    try:
                        error_detail = response.json()
                    except Exception:
                        error_detail = response.text[:500]
                    return {
                        "success": False,
                        "message": f"连接失败 (HTTP {response.status_code})",
                        "error": str(error_detail),
                    }
        except httpx.ConnectError:
            return {"success": False, "message": "无法连接到 API 服务器，请检查 URL"}
        except httpx.TimeoutException:
            return {"success": False, "message": "连接超时，请检查网络或 API 地址"}
        except Exception as e:
            return {"success": False, "message": f"连接失败: {str(e)}"}
    
    @classmethod
    async def fetch_models(cls, config: dict | None = None) -> list:
        """获取可用模型列表"""
        cfg = config or ConfigService.get_current_api_config()
        if not cfg:
            return []
        
        base_url = cfg.get("base_url", "https://api.openai.com/v1")
        url = f"{base_url.rstrip('/')}/models"
        headers = cls._get_headers(cfg)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                models = []
                for model in data.get("data", []):
                    model_id = model.get("id", "")
                    # 过滤掉非聊天模型
                    if any(x in model_id.lower() for x in ["dall-e", "whisper", "tts", "embedding", "moderation"]):
                        continue
                    models.append({
                        "id": model_id,
                        "owned_by": model.get("owned_by", ""),
                    })
                return models
        except Exception as e:
            print(f"获取模型列表失败: {e}")
            return []
    
    @classmethod
    def _resolve_config(cls, options: dict | None) -> dict:
        """解析配置：合并自定义配置和默认配置"""
        if options and "custom_api" in options:
            custom = options["custom_api"]
            return {
                "base_url": custom.get("apiurl") or custom.get("base_url", ""),
                "api_key": custom.get("key") or custom.get("api_key", ""),
                "model": custom.get("model", "gpt-4o"),
                "temperature": 0.7,
                "top_p": 1.0,
                "presence_penalty": 0.0,
                "frequency_penalty": 0.0,
                "max_tokens": 4096,
            }
        
        config = ConfigService.get_current_api_config()
        if not config:
            config = {
                "base_url": "https://api.openai.com/v1",
                "api_key": "",
                "model": "gpt-4o",
                "temperature": 0.7,
                "top_p": 1.0,
                "presence_penalty": 0.0,
                "frequency_penalty": 0.0,
                "max_tokens": 4096,
            }
        return config
