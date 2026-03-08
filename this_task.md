# LinguoSovereign (语言主权) 项目任务拆解

- [x] **项目环境规划与初始化**
  - [x] 确定目标文件路径，执行 `npx create-next-app` 初始化项目
  - [x] 配置 Tailwind CSS 与基础依赖 (shadcn-ui)
  - [x] 映射本地静态资源库 (`/Users/ronaldlee/Desktop/IELTS_Json`)

- [x] **数据库架构设计与配置 (Prisma/PostgreSQL)**
  - [x] 构建 IELTSQuestionUnit, Question, UserPrompt, Submission 等基础模型
  - [x] 编写初始化 Seed 脚本处理 JSON 数据入库

- [x] **API开发与业务逻辑**
  - [x] 客观题 (听力/阅读) 的评判逻辑实现
  - [x] 集成 OpenAI API，实现主观题 (写作/口语) AI 评分/补全
  - [x] 实现 Prompt 自定义管理后端逻辑

- [x] **前端组件与页面构建**
  - [x] 创建结构化客观题渲染组件 (Category A)
  - [x] 创建非结构化主观题 (含HTML极简渲染与分页) 渲染组件 (Category B)
  - [x] 实现口语录音交互组件与测评流程模拟
  - [x] 构建主干仪表盘与测试界面
  - [x] 完善全系统代码注释架构与架构文档 `SystemArchitecture.md`

- [x] **用户认证与数据中心 (Phase 2)**
  - [x] 扩展 Prisma 以支持 User & Session (NextAuth) 并关联 Submission
  - [x] 集成 NextAuth.js 配置 Credentials 机制 (邮箱注册/登录)
  - [x] 制作 Apple 风高颜值登录/注册 UI 面板
  - [x] 创建成绩聚合图表后背 API (`api/analytics`)
- [x] 制作后台仪表盘大屏 (Recharts) 注入前端 Dashboard

- [x] **Phase 3: Profile & Auth Fixes**
  - [x] Implement local Avatar image upload saving to `/public/uploads/`
  - [x] Fix `auth.ts` callbacks to include dynamically updated name/image to fix Navbar
  - [x] Implement robust user session `update()` behavior

- [x] **Phase 4: Objective Evaluation UX (Reading/Listening)**
  - [x] Add `TextHighlighter` logic for highlighting and noting text in Passages via Selection API (with dynamic, dismissible Clear menu)
  - [x] Build a Question Navigation Bar (Grid) dynamically sizing to 12-14 items per module mapped underneath
  - [x] Multi-Select bounds checking (preventing users from selecting more choices than required per task specification)

- [x] **Phase 5: State Synchronization and Detailed Review Analytics (详解)**
  - [x] Detect `localStorage` traces and display an `AlertDialog` (继续作答/重新作答) prior to component remount
  - [x] Build a `/review/[id]` page exposing the full official analysis and correct answers for submitted tests (Falls back gracefully when user hasn't submitted yet based on `UnitID`)
  - [x] Update Dashboard View (Image 2 Layout Structure): Formulate a list layout table that injects mock records indicating "Last Practice time, Last Record Result" and a URL entry connecting directly into the target `review` screen. (Records `.0` and `.5` boundaries and tracks total distinct attempts in subtext)
