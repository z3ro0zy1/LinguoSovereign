# LinguoSovereign

LinguoSovereign 是一个面向 IELTS 备考的 AI 学习平台。它把阅读、听力、写作、口语训练，以及评分、复盘、历史记录和个人数据面板收进同一套工作流里，目标不是做“题库展示站”，而是做一套可连续使用的学习软件。

当前仓库已经覆盖：

- 阅读 / 听力客观题练习
- 写作主观题作答与 AI 评分
- 口语转录评分
- 口语自由对话陪练
- 详解页与历史作答回顾页
- 登录、个人资料、头像上传、数据面板
- Nginx 自托管部署模板

## 项目定位

这个项目的核心思路是：

- 把 IELTS 训练从“分散页面 + 零碎工具”收敛成一套连续流程
- 把客观题和主观题拆成不同的评估链路，而不是强行统一
- 把 AI 用在真正有价值的地方：
  - 写作和口语评分
  - 口语实时陪练
  - 阅读详解里的语法与长难句分析

它更像一个 AI 原生学习工作台，而不是单纯的刷题页面。

## 当前功能概览

### 1. 阅读与听力

- 支持客观题答题
- 支持结果判定与对错反馈
- 支持详解页查看
- 阅读支持内容高亮
- 听力支持音频播放与转录联动

### 2. 写作

- 支持草稿输入与保存
- 支持提交后调用 AI 评分
- 支持维度化反馈展示
- 历史作答会写入数据库，可在 review 页面回看

### 3. 口语

当前口语只保留两种训练模式：

- `转录评分`
  - 用户一题一题完成 transcript
  - 全部完成后统一提交评分
- `自由对话`
  - 与 AI 连续自然对话
  - 用于口语陪练，不走“提交评分”流程

### 4. Review / 复盘

项目里有两类 review 语义：

- `/review/[id]`
  - 纯题目详解页
  - 用来看参考解析、原题资料、阅读 AI 语法分析
- `/review/[id]?submissionId=...`
  - 某次真实提交的回顾页
  - 用来看自己的历史答案、AI 分数和反馈

### 5. 用户与数据

- Credentials 登录
- 注册
- 头像上传
- 个人资料编辑
- 数据面板
- 历史记录

## 技术栈

### 前端

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Lucide 图标
- Recharts

### 后端

- Next.js Route Handlers
- NextAuth
- Prisma 7
- PostgreSQL
- `pg` 连接池

### AI 能力

- OpenAI-compatible 接口
  - 可接 Kimi / Moonshot
  - 可预留 GLM4
- Gemini
  - 用于口语相关链路
  - 自由对话使用 Gemini Live

## 项目结构

你最需要先认识的目录是：

```text
src/
  app/
    api/                # 所有服务端接口
    eval/[id]/          # 作答页
    review/[id]/        # 详解 / 历史回顾页
    dashboard/analytics # 数据面板
    profile/            # 个人资料
  components/
    eval/               # 作答主组件
    ui/                 # 基础 UI 组件
  lib/
    ai.ts               # AI 模型与调用封装
    prisma.ts           # Prisma 与 pg 连接池
    auth.ts             # NextAuth 配置
    i18n.ts             # 文案

prisma/
  schema.prisma         # 数据模型

docs/
  口语模块全流程说明.md
  客观题性能改造说明.md
  Nginx自托管部署说明.md
  Nginx从零上手操作手册.md
  数据库连接池与多用户并发说明.md
```

## 主要业务链路

### 阅读 / 听力客观题链路

1. 用户进入 `/eval/[id]`
2. `EvalWrapper` 根据题型分发到 `ObjectiveRenderer`
3. 用户作答
4. 提交到 `/api/eval/objective`
5. 服务端比对正确答案
6. 返回结果并支持进入 review

### 写作链路

1. 用户登录后进入写作作答页
2. `SubjectiveRenderer` 收集文本
3. 提交到 `/api/eval/subjective`
4. 后端调用 OpenAI-compatible 模型评分
5. 分数与反馈写入 `Submission`
6. 用户可在历史记录和 review 中回看

### 口语转录评分链路

1. 用户进入 `转录评分`
2. 一题一题完成 transcript
3. 三个 part 全部完成后统一提交
4. 请求 `/api/eval/subjective`
5. 后端做口语维度评分
6. 评分结果写入 `Submission`

### 口语自由对话链路

1. 用户进入 `自由对话`
2. 前端建立 Gemini Live 会话
3. 用户与 AI 连续对话
4. 当前会话记录保留在页面内
5. 该模式默认不走正式评分提交流程

详细设计见：

- [口语模块全流程说明](./docs/口语模块全流程说明.md)

## 数据库模型摘要

核心表有这些：

- `User`
  - 用户资料
- `QuestionUnit`
  - 一个练习单元，例如某个 Passage / Part / Task
- `Question`
  - 隶属于 `QuestionUnit` 的子题
- `Submission`
  - 用户某次正式提交
- `UserPrompt`
  - Prompt 模板，支持 `category + purpose`

### 题型是怎么区分的

`Submission` 表里不直接放大类名称，而是通过：

- `Submission.unitId`
- 关联到 `QuestionUnit`
- 再读取 `QuestionUnit.category`

来判断这条提交属于：

- Reading
- Listening
- Writing
- Speaking

## 环境要求

建议本地环境：

- Node.js 20+
- PostgreSQL 15+
- npm 或 pnpm

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

然后至少填写：

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- AI 供应商相关 key

### 3. 初始化 Prisma

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发环境

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量说明

### 数据库

- `DATABASE_URL`
- `DATABASE_POOL_MAX`
- `DATABASE_POOL_MIN`
- `DATABASE_POOL_IDLE_TIMEOUT_MS`
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS`

### 认证

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### OpenAI-compatible 模型

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_SPEAKING_EVAL_MODEL`
- `OPENAI_READING_ANALYSIS_MODEL`

### GLM 预留

- `GLM_API_KEY`
- `GLM_BASE_URL`
- `GLM_MODEL`
- `GLM_SPEAKING_EVAL_MODEL`
- `GLM_READING_ANALYSIS_MODEL`

### Gemini

- `GEMINI_API_KEY`
- `GEMINI_SPEAKING_MODEL`
- `GEMINI_SPEAKING_EVAL_MODEL`
- `GEMINI_SPEAKING_TEXT_MODEL`

完整模板见：

- [.env.example](./.env.example)

## 当前默认模型分工

以当前代码为准：

- 写作评分：
  - 走 OpenAI-compatible
- 口语转录评分：
  - 走 OpenAI-compatible / Kimi 类接口
- 口语自由对话：
  - 走 Gemini Live
- 阅读 AI 解析：
  - 走 OpenAI-compatible

具体实现集中在：

- [src/lib/ai.ts](./src/lib/ai.ts)

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Prisma 相关：

```bash
npx prisma generate
npx prisma db push
npx prisma studio
```

类型检查：

```bash
npx tsc --noEmit
```

## 资源文件说明

这个仓库没有把完整真题资源全部直接塞进 Git。

原因很现实：

- 听力音频体积大
- 图片资源多
- Git 不适合长期承载大体积二进制资源

因此本地完整运行时，你可能还需要额外准备：

- `public/` 下的听力音频
- 某些题目的图片资源

如果没有这些资源，可能出现：

- 听力不能播放
- 图片不显示
- 某些 review 页面缺少媒体内容

## 部署建议

### 开发环境

直接：

```bash
npm run dev
```

### 生产环境

建议：

```bash
npm run build
npm run start
```

如果是自托管，推荐：

- Nginx 反向代理
- systemd 托管 Next.js 服务
- PostgreSQL 独立运行

部署文档见：

- [Nginx 自托管部署说明](./docs/Nginx自托管部署说明.md)
- [Nginx 从零上手操作手册](./docs/Nginx从零上手操作手册.md)
- [数据库连接池与多用户并发说明](./docs/数据库连接池与多用户并发说明.md)

## 当前已经做过的性能治理

项目已经针对客观题页面做过一轮性能重构，主要包括：

- 计时器从大组件顶层拆出
- 只在答案变化时写入本地草稿
- `localStorage` 由多 key 改成单 key
- passage 区与题目区逐步拆分
- 高亮逻辑从主组件中剥离

详细见：

- [客观题性能改造说明](./docs/客观题性能改造说明.md)

## 相关文档

- [新手说明](./docs/BEGINNER_GUIDE.md)
- [系统架构说明](./docs/SystemArchitecture.md)
- [口语模块全流程说明](./docs/口语模块全流程说明.md)
- [AI 模型配置说明](./docs/AI模型配置说明.md)
- [客观题性能改造说明](./docs/客观题性能改造说明.md)
- [Nginx 自托管部署说明](./docs/Nginx自托管部署说明.md)
- [Nginx 从零上手操作手册](./docs/Nginx从零上手操作手册.md)
- [数据库连接池与多用户并发说明](./docs/数据库连接池与多用户并发说明.md)
- [AGENT_CONTEXT](./AGENT_CONTEXT.md)

## 当前已知限制

- 口语自由对话依赖实时语音链路，网络波动时可能影响体验
- 完整资源包不默认随仓库分发
- 阅读 AI 解析当前偏开发期增强能力
- 仍有部分页面在继续做前端统一整理

## 适合下一步继续做的方向

- 首页与模块页视觉继续统一
- 阅读 AI 解析结构化展示
- 更稳定的口语字幕与音频诊断
- 高成本 AI 接口的缓存与限流
- 多实例部署与负载均衡治理

## 说明

这个 README 现在就是主中文文档，不再承担中英文入口页的职责。

如果你只想快速上手，建议先读：

1. 本 README
2. [新手说明](./docs/BEGINNER_GUIDE.md)
3. [口语模块全流程说明](./docs/口语模块全流程说明.md)
4. [Nginx 从零上手操作手册](./docs/Nginx从零上手操作手册.md)
