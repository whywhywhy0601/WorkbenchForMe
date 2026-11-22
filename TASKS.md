# 开发任务清单｜My Workspace V1.0

**状态图例：** ✅ 已完成并验证 · ⚠️ 已实现但受环境限制未实测 · ⏳ 未开始  
**优先级：** P0 本期必须 · P1 第二阶段 · P2 后续优化

---

## 阶段一：项目初始化与基础架构

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | 项目脚手架 | 初始化 React + TS + Vite + Express 单仓库，配置开发 / 构建 / 生产脚本 | — | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | `npm run dev` 同时启动前端与 API | 两端均可访问，构建通过 | P0 | ✅ |
| T-002 | 设计系统与 App Shell | 设计 token、双主题、侧栏、顶栏、页面容器、按钮 / 卡片 / 表单 / 模态 / Toast / 确认框 | T-001 | `src/styles/*`, `src/app/*`, `src/components/layout/*`, `src/components/ui/*` | 统一的 macOS 玻璃视觉骨架 | Light/Dark 全站一致，响应式生效 | P0 | ✅ |
| T-003 | 文件夹式工作台 | 三个立式文件夹、悬停抽取、菜单展开、点击固定、今日概览 | T-002 | `src/pages/Workspace.tsx`, `pages-workspace.css` | 首页成为产品入口 | 悬停 / 点击 / 键盘可展开并进入子功能 | P0 | ✅ |
| T-004 | 全局导航与主题切换 | 树状导航、可收起、移动端抽屉、面包屑、主题持久化 | T-002 | `Sidebar.tsx`, `TopBar.tsx`, `AppShell.tsx`, `ThemeProvider.tsx` | 任意页面可快速切换模块 | 当前页高亮、移动端可开关、主题刷新保留 | P0 | ✅ |

---

## 阶段二：数据层与后端 API

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-010 | SQLite 数据库与种子 | 16 张业务表、索引、WAL、外键、默认设置、30 张单词卡 | T-001 | `server/db.js`, `server/seed.js` | 首次启动自动建库 | 删除 data 后可自愈重建 | P0 | ✅ |
| T-011 | 设置与仪表盘 API | 身高 / 饮水目标、首页聚合统计 | T-010 | `server/routes/settings.js` | 首页一次请求获得统计 | 数值与实际记录一致 | P0 | ✅ |
| T-012 | 文献 CRUD / 上传 / 文件服务 | 添加去重、状态与进度、附件、按 ID 提供文件 | T-010 | `server/routes/papers.js`, `server/upload.js`, `server/routes/files.js` | 文献库闭环 | 上传 / 下载内容一致，限制生效 | P0 | ✅ |
| T-013 | 高亮与批注 API | 归一化矩形、颜色、评论、页面笔记、编辑 / 删除 | T-012 | `papers.js` 批注部分 | 批注持久化 | 刷新后完整恢复 | P0 | ✅ |
| T-014 | Word / Markdown / 文本解析 | DOCX → HTML（内嵌图片）、MD/TXT 文本、DOC 文本提取 | T-012 | `papers.js` `/content` | 非 PDF 可在线阅读 | DOCX / MD 内容正确渲染 | P1 | ✅ |
| T-015 | OpenAlex 服务与缓存 | 最新论文、搜索、摘要还原、核心期刊过滤、6h / 30min 缓存 | T-010 | `server/services/openalex.js`, `server/routes/discovery.js` | 真实论文数据 | 返回 5+3 篇并带元数据 | P0 | ✅ |
| T-016 | AI 对话与工具调用 | 智谱 Chat + `search_papers` 工具循环 + 无 Key 降级 | T-015 | `server/services/zhipu.js`, `server/routes/ai.js` | AI 检索流程 | 无 Key 时返回真实 OpenAlex 结果；有 Key 时工具调用可用 | P0 | ✅ 已用 glm-5.3-flash 实测 |
| T-017 | AI 趋势总结 | 基于真实文献元数据生成中文总结并缓存 | T-016 | `zhipu.js`, `discovery.js` | 趋势卡片 | 有 Key 时生成；无 Key 显示关键词汇总 | P0 | ✅ 已用 glm-5.3-flash 实测 |
| T-018 | 习惯与单词卡 API | 打卡 / 取消 / 备注、连续统计、内置牌组 | T-010 | `server/routes/habits.js` | 日历数据闭环 | 统计正确、未来日期拒绝 | P0 | ✅ |
| T-019 | 健康 API | 健康档案（性别/生日/年龄/身高）、体重、估算体脂、饮水条目 | T-010 | `server/routes/health.js`, `server/routes/settings.js` | 健康数据闭环 | 公式计算正确、未来日期拒绝、同日体重覆盖 | P0 | ✅ |
| T-020 | 课程 API | 课程、资料、笔记、打卡、进度、级联删除 | T-010 | `server/routes/courses.js` | 课程闭环 | 文件与关联数据清理正确 | P0 | ✅ |
| T-021 | 备忘录 API | 搜索、置顶、自动保存接口 | T-010 | `server/routes/memos.js` | 备忘闭环 | 刷新保留、搜索有效 | P0 | ✅ |
| T-022 | 提醒 API | 日期 / 时间 / 优先级 / 分类 / 完成归档 | T-010 | `server/routes/reminders.js` | 提醒闭环 | 逾期与完成状态正确 | P0 | ✅ |
| T-023 | JSON 导出 | 全部业务表 + 设置快照下载 | T-010 | `server/routes/export.js` | 手动备份 | 文件名 / 内容正确 | P1 | ✅ |
| T-024 | PDF.js 资源与安全 | 本地 CMap / 字体 / wasm / ICC；SSRF 与上传限制 | T-012 | `server/index.js`, `upload.js`, `papers.js` | 离线 PDF 渲染 | 资源 200；危险 URL 被拒绝 | P0 | ✅ |

---

## 阶段三：论文阅读前端

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-030 | 最新论文页 | 数据源条、趋势卡片、关键词、国外 / 国内分组、刷新 | T-015 | `src/pages/research/LatestPapers.tsx`, `components/papers/PaperCard.tsx` | 发现页 | 真实数据、加载 / 错误 / 缓存状态可见 | P0 | ✅ |
| T-031 | AI 研究助手面板 | 建议问题、对话、Markdown、结果同步到左侧、降级提示 | T-016, T-030 | `components/papers/AiAgentPanel.tsx` | 右侧对话框 | 无 Key 可检索并同步结果 | P0 | ✅ 降级与已连接路径均实测 |
| T-032 | 文献库与未读预览 | 三档文件夹、搜索、上传、预览、开始阅读 | T-012 | `src/pages/research/PaperReader.tsx` | 阅读器左侧库 | 文件夹计数 / 切换 / 上传正确 | P0 | ✅ |
| T-033 | PDF 渲染与文本层 | Canvas 高 DPI、TextLayer、缩放、翻页、适合宽度 | T-024, T-032 | `components/reader/PdfStage.tsx` | 可读可选中 | 页面清晰、文本可选、缩放正确 | P0 | ✅ |
| T-034 | 高亮与批注 UI | 选区浮动工具栏、5 色高亮、评论、覆盖层、批注面板 | T-013, T-033 | `PdfStage.tsx`, `ReaderWorkspace.tsx` | 阅读批注闭环 | 创建 / 编辑 / 删除 / 刷新恢复 | P0 | ✅ |
| T-035 | 阅读保存与状态 | 自动保存进度、显式保存、状态选择弹窗、全屏 | T-012, T-033 | `ReaderWorkspace.tsx` | 读完流程 | 页码恢复、状态切换 | P0 | ✅ |
| T-036 | 全文搜索 | 跨页搜索、结果片段、跳转 | T-033 | `ReaderWorkspace.tsx` | 快速定位内容 | 结果可点击跳页 | P1 | ✅ |
| T-037 | DOCX / Markdown 阅读 | 文档纸张视图、字号缩放、安全渲染 | T-014 | `DocumentStage`, `ReaderWorkspace.tsx` | 非 PDF 阅读 | DOCX / MD 内容正确显示 | P1 | ✅ |
| T-038 | 开放获取 PDF 抓取 | 下载、校验、附加、失败回退 | T-012 | `ReaderWorkspace.tsx`, `papers.js` | 减少手动上传 | 成功附加；失败提示上传 | P1 | ✅ |
| T-039 | 文献详情抽屉 | 完整元数据、摘要、主题、关键词、原文入口 | T-030 | `PaperDetailDrawer.tsx` | 发现页详情 | 打开 / 加入阅读正常 | P0 | ✅ |

---

## 阶段四：日常活动

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-040 | 多邻国 / 单词打卡 | 连续 hero、月历、本周节奏、备注与记录、单词卡 | T-018 | `src/pages/daily/Habits.tsx`, `MonthCalendar.tsx` | 两个习惯页 | 打卡 / 取消 / 统计 / 单词卡正常 | P0 | ✅ |
| T-041 | 健康仪表盘 | KPI、BMI、估算体脂趋势、饮水环与柱状图、日历、历史表 | T-019 | `src/pages/daily/Health.tsx`, `components/charts/*` | 健康页 | 增删改查、图表与日历联动 | P0 | ✅ |
| T-042 | 网课课程列表 | 课程卡片、统计条、新建 / 编辑弹窗 | T-020 | `Courses.tsx` | 课程入口 | 创建后进入详情 | P0 | ✅ |
| T-043 | 课程详情 - 资料 | 拖放上传、类型图标、打开 / 下载 / 删除 | T-020 | `Courses.tsx` | 资料管理 | 上传 / 删除正确 | P0 | ✅ |
| T-044 | 课程详情 - 笔记 | 笔记列表、Markdown 编辑 / 预览、防抖自动保存、切换前落库 | T-020 | `Courses.tsx` | 笔记空间 | 自动保存状态准确 | P0 | ✅ |
| T-045 | 课程详情 - 学习日历 | 打卡、时长、备注、取消、最近学习、进度滑块 | T-020 | `Courses.tsx` | 学习记录 | 日历 / 统计 / 进度持久化 | P0 | ✅ |

---

## 阶段五：事件记录与设置

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-050 | 备忘录页 | 双栏、搜索、置顶、Markdown、自动保存、删除 | T-021 | `src/pages/life/Memos.tsx` | 轻量记录 | 新建 / 编辑 / 置顶 / 搜索 / 刷新保留 | P0 | ✅ |
| T-051 | 提醒事项页 | 统计、快速添加、筛选、分类、分组、编辑 / 完成 / 删除 | T-022 | `src/pages/life/Reminders.tsx` | 任务管理 | 逾期 / 今日 / 完成归档正确 | P0 | ✅ |
| T-052 | 设置页 | 主题、健康档案摘要与编辑、AI 配置说明、数据统计、导出、关于 | T-011, T-023 | `src/pages/Settings.tsx` | 统一设置入口 | 保存生效、导出可下载 | P0 | ✅ |
| T-053 | 健康档案与体脂估算 | 首次使用引导填写性别/生日/年龄/身高；按公式计算 BMI / 体脂率；修复弹窗焦点抢占 | T-019 | `components/health/HealthProfileModal.tsx`, `Health.tsx`, `Overlay.tsx` | 自动估算与档案管理 | 首次弹窗、公式正确、历史重算、输入焦点不被关闭按钮夺取 | P0 | ✅ |
| T-054 | 阅读器选择竞态修复 | 完成论文后文件夹切换和选择其他论文仍显示旧论文 | T-032, T-035 | `src/pages/research/PaperReader.tsx` | 阅读器状态稳定 | 完成 -> 切换未读/阅读中/已读完 -> 开始阅读均正确；空文件夹不保留旧论文 | P0 | ✅ |

---

## 阶段六：质量、测试与交付

| ID | 任务 | 描述 | 依赖 | 涉及模块 | 预期结果 | 验收标准 | 优先级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-060 | 类型检查与生产构建 | `tsc --noEmit` + `vite build` | 全部前端 | `package.json`, `dist/` | 零类型错误构建 | 构建成功，PDF worker 输出 | P0 | ✅ |
| T-061 | API 冒烟测试 | 只读检查 13 项接口 + 可选 OpenAlex | 后端 | `scripts/smoke.mjs` | 可重复运行 | 13/13 通过 | P0 | ✅ |
| T-062 | 浏览器 E2E | Playwright 覆盖论文、PDF、习惯、健康、课程、备忘、提醒、设置、移动端 | 全部 | 临时测试脚本 | 核心流程验证 | 8/8 + 7/7 + 6/6 + 最终回归通过 | P0 | ✅ |
| T-063 | 视觉与响应式检查 | 逐页截图、暗色、390px 移动端、无水平溢出 | T-060 | `docs/screenshots/` | 设计一致 | 截图确认无遮挡 / 溢出 | P0 | ✅ |
| T-064 | 生产模式验证 | 静态首页、SPA fallback、API、CMap、导出 | T-060 | `dist/`, `server/index.js` | 生产可运行 | 各路径 200 | P0 | ✅ |
| T-065 | 文档交付 | PRD、技术方案、任务、测试报告、README | 全部 | `*.md` | 完整交付文档 | 与实现一致 | P0 | ✅ |

---

## 未开始 / 后续任务

| ID | 任务 | 描述 | 优先级 | 状态 |
| --- | --- | --- | --- | --- |
| F-001 | 智谱 Key 实测与调优 | 用真实 Key 验证工具调用、模型兼容性、超时与错误映射 | P0 收尾 | ✅ 已完成（glm-5.3-flash） |
| F-002 | 基于 PDF 全文的 AI 总结 / 问答 | 提取全文、分段、引用定位、RAG | P1 | ⏳ |
| F-003 | 系统通知提醒 | macOS / 浏览器通知、提醒时间调度 | P1 | ⏳ |
| F-004 | Word / Markdown 划词高亮 | 文本锚点与 HTML 覆盖层 | P1 | ⏳ |
| F-005 | 数据导入与定时备份 | JSON 导入、自动备份策略 | P1 | ⏳ |
| F-006 | 中文数据库接入 | CNKI / 万方 / 维普授权 API | P2 | ⏳ |
| F-007 | Electron / Tauri 封装 | 原生窗口、菜单栏、开机启动 | P2 | ⏳ |
| F-008 | 跨模块搜索 | 论文 / 备忘 / 笔记 / 提醒统一检索 | P2 | ⏳ |
| F-009 | 更丰富统计 | 阅读时长、习惯洞察、体重目标线 | P2 | ⏳ |
| F-010 | 个性化工作台 | 文件夹排序、快捷卡片、布局配置 | P2 | ⏳ |
| F-011 | 笔记关联具体资料 | 为课程笔记增加资料附件选择与跳转 | P1 | ⏳ |

---

## 验证备注

- 所有 ✅ 项均通过实际构建、API 调用、数据库检查或浏览器自动化验证；详见 [TEST_REPORT.md](TEST_REPORT.md)。
- T-016 / T-017 / T-031 已使用真实 Key 和 `glm-5.3-flash` 完成工具调用、趋势生成与前端对话实测；详见测试报告。免费模型 `glm-4.7-flash` 在当时账户下返回 429 且不在可用模型列表中，因此默认模型切换为 `glm-5.3-flash`。
- 测试使用独立临时数据目录，交付前已删除测试数据；`data/` 由用户首次启动时自动创建。
