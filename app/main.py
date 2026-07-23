"""
哥布林巢穴 - 游戏后端服务

FastAPI 主入口，提供：
- 静态文件服务（前端 HTML）
- AI 文本生成代理
- 游戏存档管理
- 世界书数据管理
- 图片资源服务
- API 配置管理
- 大陆导出功能
"""
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# 确保项目根目录在 path 中
# 区分开发环境和打包环境，精准获取 exe 所在目录
if getattr(sys, 'frozen', False):
    # 打包后：sys.executable 是 main.exe 的完整路径
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    # 开发时：__file__ 是 main.py 的路径
    BASE_DIR = Path(__file__).resolve().parent
# 将外部根目录加入 Python 搜索路径（让 import api 生效）
sys.path.insert(0, str(BASE_DIR))
# （可选）如果想在代码中用 open('config.json') 这类相对路径，将工作目录也切过去
os.chdir(BASE_DIR)

from api.generate import router as generate_router
from api.config import router as config_router
from api.saves import router as saves_router
from api.worldbook import router as worldbook_router
from api.images import router as images_router
from api.export import router as export_router
from services.config_service import ConfigService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print("[哥布林巢穴] 游戏服务器启动中...")
    ConfigService.ensure_directories()
    print("[哥布林巢穴] 数据目录就绪，开始接受请求")
    yield
    print("[哥布林巢穴] 游戏服务器已安全关闭")


app = FastAPI(
    title="哥布林巢穴 - 游戏后端",
    description="哥布林巢穴游戏的 Python + FastAPI 后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(generate_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(saves_router, prefix="/api")
app.include_router(worldbook_router, prefix="/api")
app.include_router(images_router, prefix="/api")
app.include_router(export_router, prefix="/api")

# 静态文件服务 - 图片
images_dir = BASE_DIR / "images"
images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "message": "哥布林巢穴后端服务运行正常"}


CDN_SCRIPTS = """
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>哥布林巢穴</title>
    <!-- 全局依赖库 (CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vue-router@4.5.0/dist/vue-router.global.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/zod@3.23.8/lib/index.umd.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js"></script>
    <!-- 全局名称别名（CDN 导出的名称与代码期望的名称映射） -->
    <script>
        if (typeof jsyaml !== 'undefined') window.YAML = jsyaml;
        if (typeof Zod !== 'undefined') window.z = Zod;
    </script>
    <!-- 独立运行样式覆盖 -->
    <style>
        html, body {
            margin: 0; padding: 0;
            width: 100%; height: 100%;
            overflow: hidden;
            background: #1a1313;
        }
        #app {
            width: 100%; height: 100vh;
            min-height: 100vh !important;
        }
        .mini-goblin {
            height: 100vh !important;
            max-width: 100% !important;
            margin: 0 auto !important;
        }
    </style>
"""


@app.get("/")
async def serve_frontend():
    """服务前端 HTML 页面"""
    html_path = BASE_DIR / "static" / "index.html"
    need_copy = False
    
    if not html_path.exists():
        # 如果 static/index.html 不存在，尝试从 dist 复制
        dist_html = BASE_DIR.parent / "dist" / "哥布林巢穴-简版" / "index-v1.6.0.html"
        if dist_html.exists():
            import shutil
            shutil.copy(dist_html, html_path)
            need_copy = True
        else:
            return HTMLResponse(
                "<h1>前端文件未找到</h1><p>请将构建好的 index.html 放入 static/ 目录，"
                "或运行 <code>npm run build</code> 构建前端。</p>",
                status_code=404,
            )
    
    content = html_path.read_text(encoding="utf-8")
    
    # 注入 CDN 依赖（兼容 shim 已内置于源码中，此处仅注入全局库）
    if "CDN_INJECTED" not in content:
        injection = CDN_SCRIPTS
        if "<head>" in content:
            content = content.replace("<head>", f"<head>\n<!-- CDN_INJECTED -->\n{injection}")
        else:
            content = f"<head><!-- CDN_INJECTED -->\n{injection}</head>\n{content}"
        
        # 保存修改后的 HTML（可选，这样下次启动更快）
        # html_path.write_text(content, encoding="utf-8")
    
    return HTMLResponse(content)


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """处理 404，返回前端 SPA 页面"""
    return await serve_frontend()


if __name__ == "__main__":
    import io as _io
    import sys as _sys
    if hasattr(_sys.stdout, 'buffer'):
        _sys.stdout = _io.TextIOWrapper(_sys.stdout.buffer, encoding='utf-8', errors='replace')

    port = int(os.environ.get("PORT", 8000))
    print(f"[哥布林巢穴] 游戏服务器启动: http://localhost:{port}")
    
    # 自定义 uvicorn 日志格式为中文
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["formatters"]["access"]["fmt"] = '[哥布林巢穴] %(client_addr)s - "%(request_line)s" → %(status_code)s'
    log_config["formatters"]["default"]["fmt"] = "[哥布林巢穴] %(message)s"
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
        log_config=log_config,
    )
