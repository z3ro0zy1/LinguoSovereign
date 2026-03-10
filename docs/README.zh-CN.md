# LinguoSovereign 使用手册

[返回根 README](../README.md) | [English](./README.en.md)

LinguoSovereign 是一个基于 Next.js 的雅思练习平台，覆盖阅读、听力、写作、口语、题库管理、历史记录、AI 评估、详解复盘、数据分析与个人资料管理。

## 目录

- [1. 项目能做什么](#1-项目能做什么)
- [2. 示意图](#2-示意图)
- [3. 技术栈](#3-技术栈)
- [4. 快速开始](#4-快速开始)
- [5. 环境变量](#5-环境变量)
- [6. 主要路由](#6-主要路由)
- [7. 产品工作流](#7-产品工作流)
- [8. Review 语义](#8-review-语义)
- [9. 数据模型摘要](#9-数据模型摘要)
- [10. 当前限制](#10-当前限制)
- [11. 常用脚本](#11-常用脚本)
- [12. 常见问题](#12-常见问题)
- [13. 协作建议](#13-协作建议)
- [14. 近期可继续扩展的方向](#14-近期可继续扩展的方向)

## 1. 项目能做什么

LinguoSovereign 当前支持：

- 阅读、听力客观题练习
- 写作、口语主观题练习
- 写作 AI 判分
- 口语 AI 对话模式
- 两类 review 页面：
  - 纯题目详解页
  - 某次历史提交回顾页
- 登录用户的数据面板与历史记录
- 头像上传与个人资料编辑

### 当前产品规则

- Reading / Listening 可以不登录直接进入
- Writing / Speaking 进入作答页前必须先登录
- `/review/[id]` 不带 `submissionId` 时是纯题解页
- `/review/[id]?submissionId=...` 是某次历史作答回顾页

## 2. 示意图

![首页总览](../image.png)
![写作评估页](../image-1.png)
![题目详解页](../image-2.png)
![模块入口页](../image-3.png)

## 3. 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- NextAuth Credentials 登录
- Prisma 7 + PostgreSQL
- OpenAI-compatible AI provider 接入
- Recharts 数据可视化
- 浏览器语音 API 支撑当前口语模式

## 4. 快速开始

### 安装依赖

```bash
npm install
```

### 本地启动

先从 `.env.example` 复制一份 `.env`，然后启动：

```bash
cp .env.example .env
npm run dev
```

打开：

```text
http://localhost:3000
```

### 常见初始化命令

```bash
npm run lint
npm run build
npx prisma generate
npx prisma db push
npx tsx scripts/seed.ts
```

## 5. 环境变量

| 变量名 | 是否必须 | 作用 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | 是 | 登录 session 加密密钥 |
| `NEXTAUTH_URL` | 是 | 本地开发通常填 `http://localhost:3000` |
| `OPENAI_API_KEY` | AI 功能必需 | 模型供应商 API key |
| `OPENAI_BASE_URL` | 可选 | OpenAI 兼容服务地址 |
| `OPENAI_MODEL` | 写作 AI 必需 | 写作判分模型 |
| `OPENAI_SPEAKING_MODEL` | 可选 | 口语 AI 模型 |

### 最小示例

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
OPENAI_SPEAKING_MODEL=gpt-4o-mini
```

### Moonshot / Kimi 示例

```env
OPENAI_API_KEY=your-moonshot-key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
OPENAI_SPEAKING_MODEL=kimi-k2.5
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

## 6. 主要路由

- `/`：首页与模块浏览
- `/login`：登录页
- `/register`：注册页
- `/eval/[id]`：某一道题或某一个练习单元的作答页
- `/review/[id]`：纯题目详解页
- `/review/[id]?submissionId=...`：某次历史作答回顾页
- `/dashboard/analytics`：个人统计页
- `/profile`：个人资料页

### API 路由

- `GET /api/analytics`
- `POST /api/eval/objective`
- `POST /api/eval/subjective`
- `POST /api/speaking/live`
- `POST /api/register`
- `POST /api/upload`
- `GET /api/units`
- `GET /api/units/[id]`
- `GET/POST /api/auth/[...nextauth]`

## 7. 产品工作流

### Reading / Listening

- 从首页进入某个模块
- 作答客观题
- 提交答案
- 查看对错与解析
- 听力 review 页还会带音频播放能力

### Writing

- 进入前必须登录
- 有两种提交方式：
  - `普通提交`：只保存答案
  - `AI 判分并给建议`：保存答案并调用 AI 打分与反馈
- Review 页面可能显示：
  - 纯题解
  - 某次带 AI 反馈的历史提交

### Speaking

- 进入前必须登录
- 目前有两种入口：
  - `开始训练`：偏浏览器语音转文字练习
  - `AI 模式`：模拟 examiner 来回对话
- 当前 AI 模式还不是真正 WebRTC 级别的全双工实时语音
- 当前 speaking 技术链路是：
  - 浏览器语音识别
  - `/api/speaking/live` 返回模型回复
  - 浏览器语音播报回复

## 8. Review 语义

### 纯题解页

打开：

```text
/review/[unitId]
```

用途：

- 题干
- 图片
- 参考答案区域
- 官方解析

这里不应该自动注入最近一次提交记录。

### 历史作答回顾页

打开：

```text
/review/[unitId]?submissionId=[submissionId]
```

用途：

- 用户答案
- AI 反馈
- 历史分数
- 某次提交专属的上下文信息

### Dashboard 行为

- `Attempt History` 里的条目会跳到历史作答回顾页
- 独立的 `详解` 按钮会跳到纯题解页

## 9. 数据模型摘要

### QuestionUnit

表示一个可以进入作答的训练单元，例如：

- 阅读 Passage
- 听力 Part
- 写作 Task
- 口语 Part

关键字段：

- `title`
- `category`
- `audioUrl`
- `passage`

### Question

表示单个题目。

关键字段：

- `serialNumber`
- `type`
- `stem`
- `options`
- `answer`
- `officialAnalysis`

### Submission

表示一次保存下来的用户提交。

关键字段：

- `answers`
- `aiScore`
- `aiFeedback`
- `createdAt`

## 10. 当前限制

### 分类规则

数据库当前用的是：

- `Reading/Listening`
- `Writing`
- `Speaking`

Reading 和 Listening 的区分，当前更多依赖标题文本：

- Reading 通常标题里含 `Passage`
- Listening 通常标题里含 `Part`

### 听力 transcript 时间戳

当前仓库 **没有** 保存听力 transcript 的时间戳。
所以现在还做不到“音频播放到哪，文本就自动高亮到哪”。

当前已有：

- 音频文件
- `passage` 里的 transcript 文本

当前没有：

- 段落级 `start` / `end`
- 句子级时间戳
- 单词级时间戳

### Review 图片路径

题目里的图片现在通过统一的静态资源解析器渲染，所以这几种路径都能映射到浏览器可访问地址：

- `images/...`
- `../images/...`
- `.../public/...`

## 11. 常用脚本

### 初始化数据库内容

```bash
npx tsx scripts/seed.ts
```

### 检查音频文件

```bash
npx tsx scripts/verify_audio_files.ts
```

### 调试 analytics 分类

```bash
npx tsx scripts/debug_analytics_categories.ts
```

## 12. 常见问题

### 为什么写作和口语必须先登录？

因为这两类功能会涉及用户答案归档、AI 评分、历史记录和个性化复盘。

### 为什么 `详解` 和 `Attempt History` 点进去不一样？

因为它们本来就是两个不同页面语义：

- 一个是纯题解
- 一个是某次历史提交回顾

### 为什么听力还不能做 transcript 跟音频同步高亮？

因为当前数据里没有 transcript 时间轴。

### 为什么会看到 `JWT_SESSION_ERROR`？

通常是因为浏览器里还保留着旧的 session cookie，而当前 `NEXTAUTH_SECRET` 已经变了。
清掉 `localhost:3000` 的站点数据后重新登录即可。

## 13. 协作建议

- 不要假设旧版本 `README` 一定正确
- 改产品逻辑前，先以代码和当前运行结果为准
- 特别注意 review 页语义：
  - 不带 `submissionId` = 纯题解页
  - 带 `submissionId` = 历史提交回顾页
- 不要把 AI provider 密钥暴露到前端
- 尽量通过环境变量接 OpenAI-compatible provider
- Writing / Speaking 的鉴权要同时保留：
  - 页面入口保护
  - API 层保护

## 14. 近期可继续扩展的方向

- 听力 transcript 时间轴与高亮
- 用云端 ASR 替换浏览器 `SpeechRecognition`
- 真正的 realtime speaking voice mode
- 更丰富的写作评估布局
- 参考答案管理 UI
