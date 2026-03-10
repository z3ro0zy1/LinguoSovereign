# LinguoSovereign

[English](./docs/README.en.md) | [简体中文](./docs/README.zh-CN.md)

LinguoSovereign is an IELTS practice platform built with Next.js, covering Reading, Listening, Writing, Speaking, AI-assisted evaluation, review pages, analytics, and profile management.

LinguoSovereign 是一个基于 Next.js 的雅思练习平台，覆盖阅读、听力、写作、口语、AI 评估、详解复盘、数据面板与个人资料管理。

## Quick Links

- Human manual (EN): [docs/README.en.md](./docs/README.en.md)
- 人类使用手册（中文）: [docs/README.zh-CN.md](./docs/README.zh-CN.md)
- Beginner walkthrough: [docs/BEGINNER_GUIDE.md](./docs/BEGINNER_GUIDE.md)
- AI agent context: [AGENT_CONTEXT.md](./AGENT_CONTEXT.md)

## Screenshots

![Dashboard](./image.png)
![Writing Review](./image-1.png)
![Question Detail](./image-2.png)
![Homepage Modules](./image-3.png)

## What It Supports

- Reading and Listening objective practice
- Writing save-only submission and AI scoring
- Speaking standard mode and AI examiner mode
- Pure reference review pages and historical attempt review pages
- Authenticated analytics, history, and profile editing
- OpenAI-compatible AI provider configuration

## 30-Second Start

```bash
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Reading / Listening can be opened without login
- Writing / Speaking require login before entering the eval page
- `/review/[id]` = pure reference page
- `/review/[id]?submissionId=...` = attempt review page
