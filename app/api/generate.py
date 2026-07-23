"""
AI 生成端点

代理 AI 文本生成请求。
支持流式 (SSE) 和非流式两种模式。
"""
import json
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_service import AIService
from services.config_service import ConfigService

router = APIRouter(tags=["AI 生成"])


# ======================== 请求模型 ========================

class MessageItem(BaseModel):
    role: str  # system / user / assistant
    content: str


class GenerateRequest(BaseModel):
    messages: list[MessageItem]
    options: dict | None = None  # 可选的自定义 API 配置覆盖


class StreamGenerateRequest(BaseModel):
    messages: list[MessageItem]
    options: dict | None = None


# ======================== 生成端点 ========================

@router.post("/generate")
async def generate_text(request: GenerateRequest):
    """
    非流式文本生成
    
    接收消息列表，返回生成的文本。
    """
    # 验证 API 配置
    config = ConfigService.get_current_api_config()
    custom = request.options.get("custom_api") if request.options else None
    
    if custom:
        base_url = custom.get("apiurl") or custom.get("base_url", "")
        api_key = custom.get("key") or custom.get("api_key", "")
        model = custom.get("model", "")
    else:
        base_url = (config or {}).get("base_url", "")
        api_key = (config or {}).get("api_key", "")
        model = (config or {}).get("model", "")
    
    if not base_url:
        raise HTTPException(status_code=400, detail="请先在「API 设置」中配置 API 地址")
    if not model:
        raise HTTPException(status_code=400, detail="请先在「API 设置」中配置模型名称")
    
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        result = await AIService.generate(messages, request.options)
        return {"text": result, "success": True}
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"API 返回错误 (HTTP {e.response.status_code}): {e.response.text[:300]}"
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="无法连接到 API 服务器，请检查 API 地址")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="API 请求超时，请检查网络或 API 地址")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {str(e)}")


@router.post("/generate/stream")
async def generate_stream(request: StreamGenerateRequest):
    """
    流式文本生成 (Server-Sent Events)
    """
    # 验证配置（同非流式）
    config = ConfigService.get_current_api_config()
    custom = request.options.get("custom_api") if request.options else None
    if custom:
        base_url = custom.get("apiurl") or custom.get("base_url", "")
    else:
        base_url = (config or {}).get("base_url", "")
    
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for token in AIService.generate_stream(messages, request.options):
                data = json.dumps({"token": token}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except httpx.HTTPStatusError as e:
            err = json.dumps({"error": f"API 返回错误 (HTTP {e.response.status_code})"}, ensure_ascii=False)
            yield f"data: {err}\n\n"
        except httpx.ConnectError:
            err = json.dumps({"error": "无法连接到 API 服务器，请检查 API 地址"}, ensure_ascii=False)
            yield f"data: {err}\n\n"
        except httpx.TimeoutException:
            err = json.dumps({"error": "API 请求超时"}, ensure_ascii=False)
            yield f"data: {err}\n\n"
        except Exception as e:
            err = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
