# 哥布林巢穴 — 项目构成文档

> **技术栈**: Vue 3 + TypeScript (前端) / Python FastAPI (后端)  
> **启动**: 双击 `start.bat` → 浏览器访问 `http://localhost:8000`

---

## 一、目录总览

```
哥布林巢穴前后端/
├── app/                          # 后端 (Python FastAPI)
│   ├── main.py                   # 主入口，挂载路由和静态文件
│   ├── start.bat                 # Windows 一键启动脚本
│   ├── requirements.txt          # Python 依赖
│   ├── api/                      # 路由层 (7个端点模块)
│   │   ├── config.py             #   API配置 / 游戏设置 / 变量读写
│   │   ├── generate.py           #   AI文本生成 (流式+非流式)
│   │   ├── saves.py              #   存档 CRUD + 存档内世界书
│   │   ├── worldbook.py          #   世界书管理 + 模板大陆搜索
│   │   ├── images.py             #   图片资源服务 + 传奇人物 CRUD
│   │   └── export.py             #   大陆导出/导入 (ZIP打包)
│   ├── services/                 # 业务逻辑层
│   │   ├── ai_service.py         #   AI API 代理 (OpenAI 兼容格式)
│   │   ├── config_service.py     #   配置持久化 + API预设管理
│   │   ├── image_service.py      #   图片索引/分配/导入导出
│   │   └── save_service.py       #   存档模板/读写/重置
│   ├── data/                     # 数据文件
│   │   ├── config/               #   配置文件 (api_config / game_variables)
│   │   ├── saves/                #   游戏存档 (slot_0 ~ slot_5.json)
│   │   ├── templates/            #   默认模板 (default_save / default_worldbook)
│   │   └── worldbook/            #   动态世界书文件
│   ├── images/                   # 图片资源 (按大陆分层)
│   │   ├── 通用/                 #   全局兜底图片
│   │   ├── 默认/                 #   默认大陆 (含哥布林之王/)
│   │   ├── 古拉尔大陆/           #   每个大陆独立目录
│   │   ├── 瓦尔基里大陆/         #     ├── 索引.json
│   │   ├── 香草群岛/             #     ├── 通用/  (小兵图片)
│   │   ├── 赛菲亚大陆/           #     └── 传奇/  (英雄3阶段图)
│   │   ├── 世界树圣域/
│   │   └── 中国/                 #   自定义大陆示例
│   └── static/
│       └── index.html            # 前端单文件 (Webpack 构建产物)
│
├── src/哥布林巢穴-简版/          # 前端源码 (Vue 3 SPA)
│   ├── index.ts                  # 入口
│   ├── app.vue                   # 根组件
│   ├── version.ts                # 版本号配置
│   ├── shims/                    # SillyTavern 兼容层
│   │   └── sillytavern-shim.ts   #   模拟酒馆全局 API
│   ├── 界面显示层/               # UI 组件
│   │   ├── 主界面.vue            #   首页 (资源/回合/剧情)
│   │   ├── 探索界面.vue          #   大陆探索/侦察/战斗入口
│   │   ├── 调教界面.vue          #   角色调教/对话
│   │   ├── 编制界面.vue          #   部队编制/部署
│   │   └── 巢穴界面.vue          #   巢穴建筑管理
│   ├── 功能模块层/               # 业务逻辑
│   │   ├── 人物管理/             #   人物生成/属性/评级/传奇人物
│   │   ├── 战斗/                 #   战斗系统/部队/加成
│   │   ├── 探索/                 #   大陆解锁/侦察/AI据点生成
│   │   ├── 调教/                 #   调教流程/对话管理
│   │   ├── 巢穴/                 #   建筑/谒见厅
│   │   └── 随机事件/             #   世界传闻/势力反应
│   ├── 核心层/服务/
│   │   ├── 存档系统/             #   IndexedDB 存档/模块化管理
│   │   ├── 世界书管理/           #   世界书 CRUD/剧情记录
│   │   └── 通用服务/             #   行动力/确认框/提示
│   └── 共享资源层/               # 共享组件/工具
│
├── webpack.config.js             # Webpack 构建配置
├── package.json                  # 前端依赖
└── tsconfig.json                 # TypeScript 配置
```

---

## 二、架构设计

```
┌──────────────────────────────────────────────┐
│  浏览器 (index.html)                          │
│  ┌────────────────────────────────────────┐   │
│  │ Vue 3 SPA (单文件)                      │   │
│  │ ├─ sillytavern-shim.ts ← 兼容层        │   │
│  │ ├─ 界面显示层/ (主/探索/调教/编制/巢穴) │   │
│  │ ├─ 功能模块层/ (人物/战斗/探索/事件)    │   │
│  │ └─ 核心层/ (存档/世界书/AI/通用服务)   │   │
│  └────────────────────────────────────────┘   │
│         │ fetch / EventSource                  │
├─────────┼──────────────────────────────────────┤
│  后端   │ Python FastAPI (:8000)               │
│  ┌──────┴───────────────────────────────────┐  │
│  │ /api/generate    → AI 文本生成           │  │
│  │ /api/config      → 设置管理              │  │
│  │ /api/saves       → 存档读写              │  │
│  │ /api/worldbook   → 世界书管理            │  │
│  │ /api/images      → 图片服务              │  │
│  │ /api/export      → 大陆导出/导入         │  │
│  └──────────────────────────────────────────┘  │
│         │ httpx                                │
│         ▼                                      │
│  外部 AI (OpenAI / DeepSeek / 通义千问...)      │
└──────────────────────────────────────────────┘
```

---

## 三、核心子系统

### 1. 存档系统

- **前端主存储**: IndexedDB（6个槽位：slot_0 自动存档 + slot_1~5 手动存档）
- **后端备份**: `app/data/saves/slot_*.json`
- **模板**: `app/data/templates/default_save.json`
- **初始化**: 首次启动从模板创建 `slot_init` → 后端 `slot_0.json` 覆盖 → 同步到 Vue 响应式
- **持久化**: `saveCurrentGameData()` → IndexedDB + 异步同步到后端 JSON

存档包含 7 个模块：`baseResources`, `exploration`, `nest`, `history`, `training`, `formation`, `metadata`

### 2. 世界书系统 (SillyTavern 兼容)

- **存储**: 存档内的 `worldbook_data` 字段 + 独立 JSON 文件
- **条目**: uid + 触发关键词 + 内容 (Markdown/YAML) + 策略配置
- **类型**: 游戏设定(static) / 人物档案(dynamic) / 剧情记录 / 资源状态
- **写入**: 大陆解锁 → 从 images 索引读取传说人物 → 从模板搜索大陆设定 → 写入世界书
- **回写**: 写入后回写 `worldbook_uid` 到 images 索引防止重复

### 3. 图片管理系统

```
images/{大陆名}/
├── 索引.json     ← name/title/images/background/personality/race/identity
├── 通用/         ← 小兵/民众图片 (确定性 SHA256 分配)
└── 传奇/         ← 传说英雄 3 阶段图 (正常→腐化→完全腐化)
```

- **分配优先级**: 大陆通用 → 默认通用 → 全局通用
- **传奇图片**: 直接路径引用 `/images/{大陆}/传奇/{文件名}`
- **自定义大陆**: 通过弹窗管理传说人物，自动写入索引

### 4. 大陆系统

- **5 个默认大陆**: 古拉尔 → 瓦尔基里 → 香草群岛 → 赛菲亚 → 世界树圣域
- **解锁条件**: 前置大陆征服进度 ≥ 阈值
- **区域**: 每大陆 3-4 个区域，区域含首都和据点
- **自定义大陆**: 手动创建/AI 生成/导入 ZIP，自动解锁

### 5. AI 生成系统

- **思维链模式**: LOCATION_GENERATION / CHARACTER_GENERATION / 通用
- **支持的 API**: OpenAI / Anthropic / DeepSeek / 智谱 / 通义千问 / SiliconFlow / 本地
- **生成内容**: 据点描述 / 英雄人物 / 战前对话 / 战斗总结 / 调教记录

---

## 四、Shim 兼容层

原始代码为 SillyTavern 酒馆编写。`sillytavern-shim.ts` 模拟了酒馆全局 API：

| 原始 API | Shim 实现 |
|----------|----------|
| `TavernHelper.generate()` | → `POST /api/generate` |
| `getVariables()` | → 内存存储 + 异步持久化 |
| `TavernHelper.getWorldbook()` | → `GET /api/saves/slot_0/worldbook` |
| `TavernHelper.replaceWorldbook()` | → `PUT /api/saves/slot_0/worldbook` |

---

## 五、构建与部署

```bash
# 前端构建
pnpm install
npx webpack --mode production
cp dist/哥布林巢穴-简版/index.html app/static/

# 后端启动
cd app
pip install -r requirements.txt
python main.py
# 或双击 start.bat
```
