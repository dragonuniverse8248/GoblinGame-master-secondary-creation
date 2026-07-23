# 哥布林巢穴 — AI 驱动的日式奇幻巢穴经营游戏

> 你是一群哥布林的王。征服大陆，掠夺女性，经营巢穴，崛起于流放之地 — 古拉尔。
>
> **技术栈**: Vue 3 + TypeScript | Python FastAPI | LLM 驱动

---

## 🌟 项目亮点

- 🧠 **AI 驱动剧情**：由大语言模型 (LLM) 实时生成据点描述、英雄角色、战前对话、调教记录与战斗总结。
- 🌏 **动态世界书**：兼容 SillyTavern 格式，自动归档剧情与人物，上下文记忆持久化，告别同质化剧情。
- ⚔️ **经营与征服双循环**：建设巢穴繁衍生息，编制部队掠夺资源与女性，攻略传说英雄。
- 🎨 **自适应图片系统**：传说人物拥有正常 → 半堕落 → 完全堕落三阶段立绘，支持自定义大陆导入。
- 📖 **智能题库与模板**：内置丰富的大陆设定、种族设定、职业设定模板，AI 可自行衍生传奇故事。

---

## 🎮 游戏功能

### 1. 大陆探索
- **五大洲逐级解锁**：古拉尔大陆 → 瓦尔基里大陆 → 香草群岛 → 赛菲亚大陆 → 世界树圣域。
- **AI 实时侦察**：派出侦察队，AI 生成据点描述、守军、奖励及可能的英雄。
- **自定义大陆**：支持手动创建、AI 生成或 ZIP 导入/导出，无限扩展游戏内容。

### 2. 巢穴经营
- **设施建造**：繁殖室（增加哥布林数量）、调教室（调教俘虏）、资源设施（生产金币与食物）。
- **谒见厅**：任命完全调教的角色为秘书，提供全局 Buff 加成。
- **回合制结算**：每回合消耗行动力执行操作，结束后结算资源、角色状态、威胁度及随机事件。

### 3. 战斗与调教
- **部队编制**：编制哥布林部队（普通/战士/萨满/圣骑士），由调教后的角色担任队长。
- **战前对话**：根据角色性格与状态进行战前交涉，降低敌方士气。
- **俘虏调教**：击败英雄后自动捕获，进行对话调教或一键调教，改变忠诚度。
- **角色档案**：每个角色拥有详细的背景故事、属性、外观、人生经历及秘密。

---

## 🏗️ 项目架构

```
浏览器 (Vue 3 SPA)
│  IndexedDB (本地存档)
│
└── fetch / EventSource ──► Python FastAPI (:8000)
    ├── /api/generate    → AI 文本生成 (流式)
    ├── /api/saves       → 存档同步
    ├── /api/worldbook   → 世界书 CRUD
    ├── /api/images      → 图片资源服务
    └── /api/export      → 大陆导出/导入
        │
        ▼
    外部 AI (OpenAI / DeepSeek / 智谱 / 通义千问...)
```

---

## 🚀 快速开始

### 环境要求
- Python >= 3.11
- Node.js >= 18 (仅构建前端时必要)
- 已配置的 LLM API Key (OpenAI 兼容格式即可)

### 安装与运行
1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/goblin-nest.git
   cd 哥布林巢穴前后端
   ```

2. **配置 AI Key**
   修改 `app/data/config/api_config.json` 文件，填入你的 LLM API 地址与 Key。

3. **启动服务**
   - **Windows 用户**: 双击 `app/start.bat或start.exe`
   - **手动启动**:
     ```bash
     cd app
     pip install -r requirements.txt
     python main.py
     ```

4. **进入游戏**
   浏览器访问 `http://localhost:8000`

> 💡 **提示**: 启动脚本已自动安装依赖，无需手动执行。

---

## ⚙️ 配置说明

插件支持几乎所有主流大模型平台，只要是兼容 OpenAI Chat Completions 格式的 API 均可使用。

- **AI 服务商**: OpenAI / Anthropic / DeepSeek / 智谱AI / 通义千问 / SiliconFlow / 本地模型。
- **思维链配置**: 支持分别为地点生成、角色生成、通用对话设置不同的思维链 Prompt。
- **存档管理**: 提供 1 个自动存档位 + 5 个手动存档位，存档实时同步至后端 JSON 文件。

---

## 📝 开发说明

### 技术栈
- **前端**: Vue 3 + TypeScript + Webpack
- **后端**: Python FastAPI
- **数据**: IndexedDB (Browser) + JSON File (Server)
- **AI 引擎**: LLM (OpenAI Compatible API)

### 目录结构
- `app/`: 后端代码与静态资源。
  - `api/`: 路由处理。
  - `services/`: AI 代理与存档服务。
  - `data/`: 配置、存档、世界书模板。
  - `images/`: 图片资源 (按大陆分层)。
- `src/哥布林巢穴-简版/`: 前端源码。
  - `界面显示层/`: Vue 组件。
  - `功能模块层/`: 核心游戏逻辑 (战斗/调教/探索/巢穴)。
  - `核心层/服务/`: 存档系统、世界书管理、Shim 兼容层。
- `webpack.config.js`: 前端构建配置。

### 构建前端
```bash
pnpm install
npx webpack --mode production
cp dist/哥布林巢穴-简版/index.html app/static/
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！  
如果你有好的大陆模板、人物设定或玩法建议，也欢迎加入讨论。

## 📄 许可证

本项目采用 MIT 许可证。
