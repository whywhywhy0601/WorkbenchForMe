# 技术方案｜My Workspace V1.0

**版本：** V1.0  
**日期：** 2026-11-22  
**对应需求：** [PRD.md](PRD.md)

---

## 1. 技术栈与选型原因

| 层 | 技术 | 原因 |
| --- | --- | --- |
| 前端框架 | React 19 + TypeScript 5 | 组件化、生态成熟、类型安全 |
| 构建工具 | Vite 8 | 启动快、HMR、PDF worker 与资源处理方便 |
| 路由 | React Router 7 | 标准 SPA 路由、嵌套路由 |
| 服务端状态 | TanStack React Query 5 | 缓存、失效、重试、请求状态统一 |
| 图标 | lucide-react | 风格统一、可树摇 |
| Markdown | marked + DOMPurify | 渲染与 XSS 清洗 |
| PDF 阅读 | pdfjs-dist 6 | Canvas 渲染、文本层、搜索、CMap / 字体资源本地化 |
| DOCX | mammoth | DOCX → 安全 HTML，支持内嵌图片 |
| DOC | word-extractor | 旧版 `.doc` 文本提取（不保留排版） |
| 后端 | Express 5（ESM） | 简单、稳定、路由清晰 |
| 数据库 | Node 内置 `node:sqlite` | 零原生编译依赖、单文件、WAL、适合本地单用户 |
| 上传 | multer 2 | 磁盘存储、大小与类型限制 |
| AI | 智谱 AI（OpenAI 兼容 Chat Completions） | 中文能力强、工具调用兼容 |
| 论文检索 | OpenAlex REST API | 免费、无需 Key、真实元数据、支持机构与主题过滤 |
| 样式 | 原生 CSS + 设计 token | 对毛玻璃、文件夹 3D、双主题有完全控制，无额外构建复杂度 |
| 图表 | 自研 SVG 图表 | 与设计系统一致、可键盘操作、可控可访问性 |

**运行环境：** Node.js ≥ 22.5（`node:sqlite`），开发使用 Node 26；macOS 优先，现代 Chrome / Safari / Edge。

---

## 2. 系统整体架构

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser (localhost:5173 dev / 127.0.0.1:8787 prod)          │
│                                                             │
│  React 19 + TypeScript                                      │
│  ├─ AppShell / Sidebar / TopBar                             │
│  ├─ Pages: Workspace / Latest / Reader / Habits / Health    │
│  │          Courses / Memos / Reminders / Settings          │
│  ├─ React Query  ←→  /api client                            │
│  ├─ PDF.js (lazy chunk) + TextLayer + highlights            │
│  └─ Custom SVG charts                                       │
└───────────────┬─────────────────────────────────────────────┘
                │ same-origin /api, /pdfjs-assets
┌───────────────▼─────────────────────────────────────────────┐
│ Express 5 (127.0.0.1:8787)                                  │
│  ├─ routes: settings/dashboard, papers, discovery, ai       │
│  │          habits, health, courses, memos, reminders       │
│  │          files, export                                   │
│  ├─ services: openalex.js, zhipu.js                         │
│  ├─ upload.js: multer + file records + remote file register │
│  ├─ db.js: node:sqlite schema + seed                        │
│  └─ static: dist/ (prod), pdfjs assets                      │
└───────────────┬──────────────────────────┬──────────────────┘
                │                          │
        data/workbench.db          data/uploads/
        (SQLite WAL)               (random filenames)

External:
  OpenAlex REST API  ← paper discovery/search
  智谱 AI API        ← chat + trend summary (optional)
```

---

## 3. 前端架构

### 3.1 入口与 Provider

```text
main.tsx
└─ ThemeProvider           // localStorage 主题，data-theme
   └─ QueryClientProvider  // React Query
      └─ ToastProvider     // 全局提示
         └─ ConfirmProvider// Promise 化确认框
            └─ App
               └─ ErrorBoundary
                  └─ BrowserRouter
                     └─ AppShell + Routes
```

### 3.2 路由

| 路径 | 页面 |
| --- | --- |
| `/` | 工作台文件夹首页 |
| `/research/latest` | 最新论文 + AI 助手 |
| `/research/reader?paper=id` | 论文库 + 阅读器 |
| `/daily/duolingo` | 多邻国打卡 |
| `/daily/vocabulary` | 不背单词打卡 |
| `/daily/health` | 减肥打卡 |
| `/daily/courses` | 课程列表 |
| `/daily/courses/:id` | 课程详情（资料 / 笔记 / 日历） |
| `/life/memos` | 备忘录 |
| `/life/reminders` | 提醒事项 |
| `/settings` | 设置 |

阅读器页面在 `AppShell` 中切换为 `app-content--flush`，由阅读器内部独立滚动。

### 3.3 状态管理

- **服务端数据：** React Query；按领域定义 query key，mutation 成功后 setQueryData / invalidate。
- **页面本地状态：** useState / useReducer 级别的表单、选中项、模态、阅读位置等。
- **持久 UI 偏好：** localStorage（主题、侧栏收起状态）。
- **业务数据：** 全部通过 API 落库，不依赖 localStorage。

### 3.4 设计系统

- `src/styles/tokens.css`：颜色、阴影、圆角、字体、动效、tone 映射、双主题、背景氛围。
- `layout.css`：应用壳、侧栏、顶栏、页面容器、响应式。
- `components.css`：按钮、卡片、表单、模态、抽屉、Toast、日历、图表、Markdown、骨架。
- `pages-*.css`：各模块样式。
- 动画使用 CSS transition / keyframes，尊重 `prefers-reduced-motion`。

### 3.5 PDF 阅读实现

- `PdfStage.tsx` 懒加载 pdfjs，避免首屏加载 ~450KB 阅读器 chunk。
- 每页渲染到高 DPI canvas；使用 pdf.js `TextLayer` 叠加透明文本层，实现选择。
- 选区通过 `Range.getClientRects()` 转成页面归一化坐标 `{x,y,w,h}`（0–1），存库。
- 高亮以绝对定位覆盖层渲染，缩放时按比例重绘。
- 文本层选区使用相对页面容器的坐标计算浮动工具栏位置。
- 搜索通过 `getTextContent()` 遍历页面，返回页码与片段并跳转。
- `cMapUrl` / `standardFontDataUrl` / `wasmUrl` / `iccUrl` 指向本地 `/pdfjs-assets/*`，由 Express 提供，离线可用。
- 打开批注侧栏后自动重新计算适合宽度，避免页面被裁切。

### 3.6 图表

- 自研 `TrendChart` / `BarChart`：
  - 2px 线、10% 面积渐变、≥8px 端点与 2px 表面描边、实线细网格。
  - 十字准线 / 单柱悬停，tooltip 值优先、日期次要。
  - SVG `tabIndex` + 方向键 / Home / End 键盘读数。
  - 每张图提供数据表切换，满足不依赖悬停的可访问性。
  - 单序列不显示多余图例；标题说明数据。
  - 范围筛选位于图表组上方，统一作用于体重 / 体脂图。

### 3.7 可访问性与响应式

- 语义化按钮、aria-label、aria-pressed、aria-expanded。
- focus-visible 样式；模态支持 Escape 与遮罩关闭。
- 文件夹支持 focus-within 展开、点击固定。
- ≤960px 侧栏变抽屉；阅读器文献库变抽屉；≤700px 主要布局单列。
- 所有页面在 390px 宽度下无水平溢出（已测试）。

---

## 4. 后端架构

### 4.1 分层

```text
server/index.js
├─ middleware: JSON (4MB), request log
├─ asset mounts: /pdfjs-assets/{cmaps,standard_fonts,wasm,iccs}
├─ /api/status
├─ routes/settings.js   (settings, dashboard)
├─ routes/papers.js     (papers, annotations, content, remote pdf)
├─ routes/discovery.js  (OpenAlex latest/search/trend cache)
├─ routes/ai.js         (status, chat tool loop)
├─ routes/habits.js     (duolingo/vocabulary, vocab deck)
├─ routes/health.js     (weights, water)
├─ routes/courses.js    (courses, files, notes, checkins)
├─ routes/memos.js
├─ routes/reminders.js
├─ routes/files.js      (serve uploads)
├─ routes/export.js     (JSON backup)
├─ production static + SPA fallback
└─ error handler (ApiError, Multer, JSON parse)
```

### 4.2 数据库

使用 `node:sqlite` 的 `DatabaseSync`，启动时执行 `CREATE TABLE IF NOT EXISTS` 并写入默认设置与内置单词卡。WAL 模式、外键开启、busy_timeout 5s。

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `settings` | 键值设置 | `height_cm`, `gender`, `birthday`, `age`, `water_goal_ml`, `theme` |
| `files` | 上传文件元数据 | `original_name`, `stored_name`, `mime`, `size`, `ext` |
| `papers` | 文献库 | `status` (`unread/reading/completed`), `openalex_id`, `doi`, `authors_json`, `topics_json`, `file_id`, `current_page`, `scroll_ratio`, `total_pages` |
| `annotations` | 高亮 / 页面笔记 | `page`, `color`, `rects_json`, `text`, `comment`, `type` |
| `habits` | 多邻国 / 单词打卡 | `(tracker, date)` 唯一，`note` |
| `weight_entries` | 体重（体脂由档案估算） | `date` 唯一，`weight`；`body_fat` 为不再使用的旧字段 |
| `water_entries` | 饮水条目 | `date`, `amount`, `created_at` |
| `courses` | 课程 | `name`, `description`, `color`, `progress` |
| `course_files` | 课程-文件关联 | `course_id`, `file_id` |
| `course_notes` | 课程笔记 | `course_id`, `title`, `content` |
| `course_checkins` | 课程学习打卡 | `(course_id, date)` 唯一，`minutes`, `note` |
| `memos` | 备忘录 | `title`, `content`, `pinned` |
| `reminders` | 提醒 | `due_date`, `due_time`, `priority`, `category`, `completed`, `completed_at` |
| `vocab_cards` | 内置单词卡 | `word`, `phonetic`, `meaning`, `example`, `example_zh` |
| `discovery_cache` | OpenAlex 缓存 | `key`, `payload`, `fetched_at` |
| `trend_summaries` | AI 趋势缓存 | `paper_key`, `content`, `model`, `created_at` |

### 4.3 健康档案与体脂率估算

- 健康档案保存在 `settings` 表：`gender`（`male` / `female`）、`birthday`（YYYY-MM-DD）、`age`、`height_cm`。
- 年龄优先使用用户确认的 `age`；缺失时由 `birthday` 推导。
- BMI = `weight / (heightCm / 100)²`。
- 体脂率估算（用户指定公式）：

```text
bodyFat = 1.20 * BMI + 0.23 * age - 10.8 * sexCoefficient - 5.4
sexCoefficient: male = 1, female = 0
```

- 服务端在 `/api/health` 中为每个体重条目返回 `estimatedBodyFat`，因此档案或体重变化后历史估算会同步重算。
- `profileComplete` 要求性别、生日、年龄（可推导）和身高齐全；不完整时前端引导填写健康档案。
- `weight_entries.body_fat` 为兼容旧数据的遗留字段；新的写入会清空它，不再作为 UI 展示依据。
- 估算结果只用于个人趋势，不构成医疗诊断。

---

## 5. API 设计

统一前缀 `/api`。错误格式：`{ "error": "可读中文信息" }`。所有写接口做字段校验。

### 5.1 系统与设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | 服务存活、日期、AI 配置摘要 |
| GET | `/api/dashboard` | 首页聚合数据（习惯、阅读、提醒、健康、课程、备忘、AI） |
| GET | `/api/settings` | 健康档案（性别、生日、年龄、身高）、饮水目标、完成状态 |
| PUT | `/api/settings` | 更新健康档案 / 饮水目标 |
| GET | `/api/export` | 下载 JSON 备份（含 settings） |

### 5.2 论文与阅读

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/papers` | 文献列表（含文件与批注计数） |
| GET | `/api/papers/:id` | 单篇详情 |
| POST | `/api/papers` | 从检索结果 / 手动添加，按 OpenAlex ID 或 DOI 去重 |
| PATCH | `/api/papers/:id` | 状态、页码、总页数、滚动比例 |
| DELETE | `/api/papers/:id` | 删除文献、批注与附件 |
| POST | `/api/papers/upload` | 上传文件创建文献 |
| POST | `/api/papers/:id/file` | 附加 / 替换原文 |
| POST | `/api/papers/:id/fetch-pdf` | 下载开放获取 PDF（大小 / 类型 / SSRF 校验） |
| GET | `/api/papers/:id/content` | DOCX → HTML、MD/TXT 文本、DOC 文本 |
| GET | `/api/papers/:id/annotations` | 批注列表 |
| POST | `/api/papers/:id/annotations` | 新建高亮 / 页面笔记 |
| PATCH | `/api/annotations/:id` | 修改评论 / 颜色 |
| DELETE | `/api/annotations/:id` | 删除批注 |
| GET | `/api/files/:id` | 按 ID 提供文件；`?download=1` 下载 |

### 5.3 发现与 AI

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/discovery/latest?refresh=1` | 国外 5 + 国内 3；6h 缓存；失败回退旧缓存 |
| GET | `/api/discovery/search?q=` | OpenAlex 检索；30min 缓存 |
| POST | `/api/discovery/trend` | 基于真实文献生成 AI 趋势（需 Key），按论文集合缓存 |
| GET | `/api/ai/status` | 是否配置、模型、工具 |
| POST | `/api/ai/chat` | 智谱工具调用循环；无 Key 时降级为 OpenAlex 检索 |

### 5.4 习惯与健康

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/habits/:tracker` | 打卡记录 + 连续 / 最长 / 累计 / 本月 |
| PUT | `/api/habits/:tracker/:date` | 打卡 / 取消 / 更新备注 |
| GET | `/api/vocab/deck` | 内置单词卡 |
| GET | `/api/health` | 健康档案、体重与估算体脂、饮水条目与按日汇总 |
| PUT | `/api/health/weights` | 按日期 upsert 体重 / 体脂 |
| DELETE | `/api/health/weights/:date` | 删除体重记录 |
| POST | `/api/health/water` | 添加饮水条目 |
| DELETE | `/api/health/water/:id` | 删除饮水条目 |

### 5.5 课程与生活

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/courses` | 列表 / 新建 |
| GET | `/api/courses/:id` | 课程 + 资料 + 笔记 + 打卡 + 统计 |
| PATCH/DELETE | `/api/courses/:id` | 编辑 / 级联删除 |
| POST | `/api/courses/:id/files` | 上传资料 |
| DELETE | `/api/courses/:id/files/:linkId` | 删除资料与磁盘文件 |
| POST | `/api/courses/:id/notes` | 新建笔记 |
| PATCH/DELETE | `/api/course-notes/:id` | 更新 / 删除笔记 |
| PUT | `/api/courses/:id/checkins/:date` | 打卡 / 更新时长与备注 / 取消 |
| GET/POST | `/api/memos` | 搜索列表 / 新建 |
| PATCH/DELETE | `/api/memos/:id` | 更新（标题、内容、置顶）/ 删除 |
| GET/POST | `/api/reminders` | 列表 / 新建 |
| PATCH/DELETE | `/api/reminders/:id` | 更新（含完成状态）/ 删除 |

---

## 6. 第三方服务集成

### 6.1 OpenAlex

- 使用 `works` 接口，`select` 限制字段以降低流量。
- 最新论文：
  - 主题过滤：`T11024, T13985, T14330, T11572, T11734, T13034`
  - 近两年、`type:article`、`primary_location.source.is_core:true`
  - 国外：`language:en` + 引用降序
  - 国内：`authorships.institutions.country_code:CN` + 引用降序
- 搜索：
  - 最近 5 年，优先核心期刊；结果不足 3 条时回退全索引。
- 摘要由 `abstract_inverted_index` 还原；PDF 链接从 `best_oa_location` / `locations` 中挑选。
- 缓存：latest 6h、search 30min；失败时回退旧缓存。
- 可选 `OPENALEX_API_KEY` / `OPENALEX_MAILTO`。

### 6.2 智谱 AI

- 环境变量：`ZHIPU_API_KEY`、`ZHIPU_MODEL`（默认 `glm-5.3-flash`）、可选 `ZHIPU_ENDPOINT`。
- Chat Completions，非流式。
- 工具：`search_papers(query, limit)`，最多 3 轮工具调用，强制最终回答。
- 系统提示要求：只引用工具返回的真实文献，不编造引用与结论。
- 趋势总结：只传入真实标题、年份、来源、引用、关键词与摘要片段，温度 0.35，按论文集合哈希缓存。
- 无 Key：直接检索 OpenAlex，并在回复中说明降级。
- Key 仅在服务端使用，不返回前端。

### 6.3 PDF.js 资源

- 从 `node_modules/pdfjs-dist` 提供 `cmaps/`、`standard_fonts/`、`wasm/`、`iccs/`。
- 开发环境通过 Vite proxy；生产环境由 Express 直接提供。
- 避免依赖 CDN，保持离线可用。

---

## 7. 身份认证与权限

- 无登录、无用户体系、无角色。
- 服务端只绑定 `127.0.0.1`，假设本机单用户。
- 若未来部署到公网，必须自行增加认证、HTTPS、反向代理与访问控制。
- API Key 属于服务端机密，前端仅能获取「是否配置 / 模型名称」。
- 文件仅能通过数据库 ID 访问，不暴露磁盘路径。

---

## 8. 错误处理机制

### 服务端

- `ApiError(status, message)` 统一业务错误。
- Express 5 异步错误自动进入错误中间件。
- Multer 超限 / 类型错误 → 413 / 400。
- JSON 解析错误 → 400。
- OpenAlex / 智谱错误 → 502，并保留可读信息。
- 文件解析失败 → 422。
- 未捕获异常记录服务端日志并返回通用 500。

### 前端

- React Query 请求失败 → 页面级 `ErrorState` 或 Toast。
- 表单本地校验 + 服务端校验双保险。
- 自动保存失败保留「未保存」状态，不静默丢失。
- 空状态、加载骨架、禁用态、Toast 反馈。
- ErrorBoundary 捕获渲染异常，提供刷新与返回入口。

---

## 9. 安全性设计

- `127.0.0.1` 绑定；无 CORS 开放。
- API Key 只在 `.env`；`.env` 与 `data/` 在 `.gitignore`。
- 上传：
  - 50MB 限制、扩展名白名单（论文：PDF/Word/MD/TXT；资料：再加图片/PPT/Excel/ZIP）。
  - 随机存储名，原始名仅存数据库。
  - 通过 `/api/files/:id` 读取，杜绝路径拼接。
- 远程 PDF：
  - 仅 http/https；阻止 localhost、私有网段、`.local`。
  - 限制 50MB、校验 Content-Type 与 `%PDF-` 魔数。
  - 校验最终重定向 URL。
- 内容清洗：
  - Markdown / AI 输出经 DOMPurify。
  - DOCX HTML 在客户端再次 DOMPurify。
  - 禁止 iframe / form / script / style 等标签。
- 删除：
  - 文献、课程、备忘录、提醒、批注等关键删除有确认。
  - 课程 / 文献级联清理关联记录与磁盘附件。
- 备份：JSON 导出，不包含原始文件。

---

## 10. 项目目录结构

```text
.
├── server/
│   ├── index.js
│   ├── db.js
│   ├── seed.js
│   ├── upload.js
│   ├── utils.js
│   ├── routes/
│   │   ├── settings.js
│   │   ├── papers.js
│   │   ├── discovery.js
│   │   ├── ai.js
│   │   ├── habits.js
│   │   ├── health.js
│   │   ├── courses.js
│   │   ├── memos.js
│   │   ├── reminders.js
│   │   ├── files.js
│   │   └── export.js
│   └── services/
│       ├── openalex.js
│       └── zhipu.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── app/                 # Theme / Toast / Confirm
│   ├── lib/                 # api, queries, format, nav
│   ├── components/
│   │   ├── layout/          # AppShell, Sidebar, TopBar
│   │   ├── ui/              # Overlay, basics, calendar, markdown
│   │   ├── charts/          # ChartCard, TrendChart, BarChart, utils
│   │   ├── papers/          # PaperCard, DetailDrawer, AiAgentPanel
│   │   ├── reader/          # ReaderWorkspace, PdfStage
│   │   └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── Workspace.tsx
│   │   ├── research/
│   │   ├── daily/
│   │   ├── life/
│   │   ├── Settings.tsx
│   │   └── NotFound.tsx
│   └── styles/
├── scripts/smoke.mjs
├── docs/screenshots/
├── public/favicon.svg
├── data/                    # 运行时生成，gitignored
├── .env.example
├── PRD.md
├── TECHNICAL_DESIGN.md
├── TASKS.md
├── TEST_REPORT.md
└── README.md
```

---

## 11. 本地开发与运行

```bash
npm install
cp .env.example .env
npm run dev
```

- Vite：`http://localhost:5173`
- API：`http://127.0.0.1:8787`
- Vite proxy：`/api` 与 `/pdfjs-assets`
- 数据目录默认 `<project>/data`，可用 `DATA_DIR` 覆盖。
- `node --watch` 自动重启 API。

环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | 8787 | API 端口 |
| `HOST` | 127.0.0.1 | 绑定地址 |
| `DATA_DIR` | `./data` | 数据目录 |
| `ZHIPU_API_KEY` | 空 | 智谱 Key |
| `ZHIPU_MODEL` | `glm-5.3-flash` | 模型 |
| `ZHIPU_ENDPOINT` | 官方 v4 地址 | 可替换代理 |
| `OPENALEX_API_KEY` | 空 | 可选额度 |
| `OPENALEX_MAILTO` | 空 | 礼貌标识 |

---

## 12. 部署方案

当前定位为**本地个人桌面工作台**，推荐：

### 生产本地运行

```bash
npm run build
npm start
```

- Express 提供 `dist/`、SPA fallback、API、PDF.js 资源。
- 访问 `http://127.0.0.1:8787`。
- 进程管理可用 `pm2` 或 macOS `launchd`（可选）。

### 未来可选

- **Tauri / Electron**：包装现有 Web 前端与本地 API，获得原生窗口与开机启动。
- **局域网 / 公网**：必须增加认证、HTTPS、速率限制、CSRF 防护与反向代理；当前实现不适合直接公开。

---

## 13. 测试策略

1. **静态检查：** `tsc --noEmit`（严格模式、未使用变量检查）、`node --check`。
2. **构建：** `vite build`，确认生产资源与 PDF worker 输出。
3. **API 冒烟：** `scripts/smoke.mjs` 只读检查状态、健康、仪表盘、文献、单词卡、课程、备忘、提醒、设置、AI 状态、导出与 PDF.js 资源；`--online` 额外验证 OpenAlex。
4. **浏览器 E2E：** Playwright + 系统 Chrome，覆盖最新论文、AI 降级检索、加入阅读、PDF 渲染 / 搜索 / 翻页 / 高亮 / 批注持久化、保存弹窗、打卡、健康记录与图表、课程资料 / 笔记 / 日历、备忘自动保存、提醒生命周期、主题、移动端。
5. **视觉检查：** 逐页截图检查布局、文本碰撞、暗色模式、移动端溢出。
6. **生产模式检查：** 静态首页、SPA fallback、API、CMap 资源。

详细结果见 [TEST_REPORT.md](TEST_REPORT.md)。

---

## 14. 已知约束与后续演进

- 智谱工具调用与 AI 趋势生成已在本地使用 `glm-5.3-flash` 实测；推理模型会消耗 `reasoning_content` token，趋势生成最大输出设为 6000。模型可用性与配额随账户变化，必要时调整 `ZHIPU_MODEL`。
- OpenAlex 对中文期刊近两年收录有限；国内文献采用「中国机构作者」定义并在 UI 说明。
- `.doc` 仅文本提取；Word / Markdown 不做划词高亮。
- 无本地通知、无导入、无自动备份。
- 单文件 SQLite 适合个人规模；若未来增加全文索引 / 多用户需迁移到更完整数据库。
- 单页 PDF 渲染在超大文件下可能有内存压力；已通过懒加载与按页渲染控制。
- 前端主 chunk 约 584KB（gzip 176KB），PDF 阅读器独立 449KB（gzip 136KB）；对本地应用可接受。

---

## 15. 关键设计决策记录

| 决策 | 原因 | 代价 |
| --- | --- | --- |
| 本地 Web 而非 Electron | 快速交付、调试简单、跨平台 | 无原生窗口 / 通知 |
| node:sqlite | 无原生编译、零额外服务 | 需要 Node ≥ 22.5 |
| 自研 SVG 图表 | 样式一致、可访问性可控 | 不支持复杂图表类型 |
| OpenAlex 而非爬虫 | 合法、稳定、结构化、免费 | 中文覆盖有限 |
| AI 非流式 | 工具调用与错误处理简单 | 长回答等待感更强 |
| 归一化高亮坐标 | 缩放后仍能定位 | 文本重排的极端 PDF 可能偏移 |
| 自动保存 + 显式保存并存 | 防丢失 + 阅读状态确认 | 需要清晰的状态反馈 |
