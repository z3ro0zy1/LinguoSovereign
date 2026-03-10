# LinguoSovereign Manual

[Back to root README](../README.md) | [简体中文](./README.zh-CN.md)

LinguoSovereign is a Next.js IELTS practice platform covering Reading, Listening, Writing, and Speaking. It combines a local question bank, answer persistence, review pages, analytics, and AI-assisted evaluation for subjective tasks.

## Table of Contents

- [1. What The App Does](#1-what-the-app-does)
- [2. Screenshots](#2-screenshots)
- [3. Tech Stack](#3-tech-stack)
- [4. Quick Start](#4-quick-start)
- [5. Environment Variables](#5-environment-variables)
- [6. Main Routes](#6-main-routes)
- [7. Product Flows](#7-product-flows)
- [8. Review Page Semantics](#8-review-page-semantics)
- [9. Data Model Summary](#9-data-model-summary)
- [10. Important Current Constraints](#10-important-current-constraints)
- [11. Useful Scripts](#11-useful-scripts)
- [12. FAQ](#12-faq)
- [13. Working Rules For Contributors](#13-working-rules-for-contributors)
- [14. Near-Term Roadmap Ideas](#14-near-term-roadmap-ideas)

## 1. What The App Does

LinguoSovereign currently supports:

- Reading and Listening objective practice
- Writing and Speaking subjective practice
- AI scoring for Writing
- AI conversation mode for Speaking
- Review pages for both:
  - pure reference view: question + sample answer / analysis
  - attempt review view: a specific historical submission
- Dashboard and analytics for authenticated users
- Profile editing and avatar upload

### Current product rules

- Reading / Listening can be opened without login
- Writing / Speaking require login before entering the eval page
- `/review/[id]` without `submissionId` is the pure reference page
- `/review/[id]?submissionId=...` is a historical attempt review page

## 2. Screenshots

![Dashboard](../image.png)
![Writing Review](../image-1.png)
![Question Detail](../image-2.png)
![Homepage Modules](../image-3.png)

## 3. Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- NextAuth Credentials auth
- Prisma 7 + PostgreSQL
- OpenAI-compatible AI provider support
- Recharts for analytics
- Browser speech APIs for current speaking practice mode

## 4. Quick Start

### Install

```bash
npm install
```

### Start local services

Create `.env` from `.env.example`, then start the app:

```bash
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

### Common setup commands

```bash
npm run lint
npm run build
npx prisma generate
npx prisma db push
npx tsx scripts/seed.ts
```

## 5. Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Session encryption secret |
| `NEXTAUTH_URL` | Yes | Base URL in local/dev, usually `http://localhost:3000` |
| `OPENAI_API_KEY` | Yes for AI features | Provider API key |
| `OPENAI_BASE_URL` | Optional | OpenAI-compatible provider base URL |
| `OPENAI_MODEL` | Yes for writing AI | Writing evaluation model |
| `OPENAI_SPEAKING_MODEL` | Optional | Speaking AI conversation model |

### Minimum example

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
OPENAI_SPEAKING_MODEL=gpt-4o-mini
```

### Example: Moonshot / Kimi

```env
OPENAI_API_KEY=your-moonshot-key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
OPENAI_SPEAKING_MODEL=kimi-k2.5
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

## 6. Main Routes

- `/`: dashboard home and module browser
- `/login`: credentials login page
- `/register`: registration page
- `/eval/[id]`: practice page for one unit
- `/review/[id]`: pure reference / explanation page
- `/review/[id]?submissionId=...`: review for one specific attempt
- `/dashboard/analytics`: personal statistics page
- `/profile`: profile and avatar management

### API routes

- `GET /api/analytics`
- `POST /api/eval/objective`
- `POST /api/eval/subjective`
- `POST /api/speaking/live`
- `POST /api/register`
- `POST /api/upload`
- `GET /api/units`
- `GET /api/units/[id]`
- `GET/POST /api/auth/[...nextauth]`

## 7. Product Flows

### Reading / Listening

- Open a module from dashboard
- Answer questions
- Submit objective answers
- Review correctness and explanations
- Listening review includes audio playback

### Writing

- Login is required before entering
- Two submission modes:
  - `普通提交`: save only
  - `AI 判分并给建议`: save + AI score + feedback
- Review page can show:
  - reference-only view
  - historical submission with AI feedback

### Speaking

- Login is required before entering
- Two entry modes:
  - `开始训练`: browser speech-to-text practice
  - `AI 模式`: examiner-style conversational loop
- Current AI mode is not full duplex realtime voice
- Current speaking stack is:
  - browser speech recognition
  - model reply from `/api/speaking/live`
  - browser speech synthesis for playback

## 8. Review Page Semantics

### Pure reference view

Open:

```text
/review/[unitId]
```

Used for:

- question stem
- images
- sample answer area
- official analysis

This should not automatically inject the latest submission.

### Attempt review view

Open:

```text
/review/[unitId]?submissionId=[submissionId]
```

Used for:

- user response
- AI feedback
- historical score
- attempt-specific context

### Dashboard behavior

- `Attempt History` entries link to attempt review view
- the standalone `详解` button links to the pure reference view

## 9. Data Model Summary

### QuestionUnit

Represents a practice unit such as:

- Reading passage
- Listening part
- Writing task
- Speaking part

Important fields:

- `title`
- `category`
- `audioUrl`
- `passage`

### Question

Represents a single question inside a unit.

Important fields:

- `serialNumber`
- `type`
- `stem`
- `options`
- `answer`
- `officialAnalysis`

### Submission

Represents one stored attempt.

Important fields:

- `answers`
- `aiScore`
- `aiFeedback`
- `createdAt`

## 10. Important Current Constraints

### Category conventions

The database uses:

- `Reading/Listening`
- `Writing`
- `Speaking`

Reading vs Listening is inferred from title text:

- Reading units usually contain `Passage`
- Listening units usually contain `Part`

### Listening transcript timestamps

The current repository does **not** store transcript timestamps.
That means the app cannot yet do audio-synced transcript highlighting.

You currently have:

- audio files
- transcript text in `passage`

You do not currently have:

- per-segment `start` / `end`
- sentence-level timestamps
- word-level timestamps

### Review images

Question images are rendered through a normalized static asset resolver so that:

- `images/...`
- `../images/...`
- `.../public/...`

can all be mapped into browser-accessible URLs.

## 11. Useful Scripts

### Seed database

```bash
npx tsx scripts/seed.ts
```

### Verify audio files

```bash
npx tsx scripts/verify_audio_files.ts
```

### Debug analytics categories

```bash
npx tsx scripts/debug_analytics_categories.ts
```

## 12. FAQ

### Why do Writing and Speaking require login?

Because they involve user-owned answers, AI scoring, history, and profile-linked persistence.

### Why are `详解` and `Attempt History` different?

Because they intentionally map to two different review semantics:

- pure reference view
- one specific historical attempt review

### Why does Listening not support transcript highlighting yet?

Because transcript timestamps are not stored in the current dataset.

### Why do I see `JWT_SESSION_ERROR`?

Usually because your browser still has a cookie generated with an older `NEXTAUTH_SECRET`.
Clear site data for `localhost:3000` and log in again.

## 13. Working Rules For Contributors

- Do not assume older documentation is still correct
- Verify runtime behavior against code before changing product logic
- Be careful with review page semantics:
  - no `submissionId` = reference page
  - with `submissionId` = attempt review
- Do not expose AI provider keys in the frontend
- Prefer OpenAI-compatible provider configuration through environment variables
- For Writing and Speaking, keep auth checks both:
  - at entry page level
  - at API level

## 14. Near-Term Roadmap Ideas

- listening transcript highlighting with timestamps
- cloud ASR replacement for browser `SpeechRecognition`
- true realtime voice mode for Speaking
- richer writing review layout with strengths / weaknesses / rewrite suggestions
- reference answer management UI
