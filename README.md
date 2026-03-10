# LinguoSovereign

LinguoSovereign is a Next.js IELTS practice platform covering Reading, Listening, Writing, and Speaking. It combines a local question bank, answer persistence, review pages, analytics, and AI-assisted evaluation for subjective tasks.

This document is the human-facing manual.
If you are an AI coding agent working inside this repository, read [AGENT_CONTEXT.md](./AGENT_CONTEXT.md) before editing code.
If you are new to the project and want a simpler walkthrough, read [docs/BEGINNER_GUIDE.md](./docs/BEGINNER_GUIDE.md).

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

## 2. Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- NextAuth Credentials auth
- Prisma 7 + PostgreSQL
- OpenAI-compatible AI provider support
- Recharts for analytics
- Browser speech APIs for current speaking practice mode

## 3. Local Setup

### Install

```bash
npm install
```

### Environment

Create `.env` from `.env.example` and fill in the required values.

Minimum required variables:

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

The app supports OpenAI-compatible providers.
For Moonshot / Kimi you can use:

```env
OPENAI_API_KEY=your-moonshot-key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
OPENAI_SPEAKING_MODEL=kimi-k2.5
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

### Start dev server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Build check

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## 4. Common Runtime Issues

### `NEXTAUTH_URL` warning

If you see a NextAuth warning about `NEXTAUTH_URL`, make sure `.env` contains:

```env
NEXTAUTH_URL=http://localhost:3000
```

Then restart `npm run dev`.

### `JWT_SESSION_ERROR` / `JWEDecryptionFailed`

This usually means your browser still has an old session cookie encrypted with a previous `NEXTAUTH_SECRET`.

Fix:

1. Stop dev server
2. Clear site data for `localhost:3000`
3. Restart `npm run dev`
4. Login again

### AI scoring does nothing

Check these in order:

1. You are logged in for Writing / Speaking
2. `OPENAI_API_KEY` is set
3. `OPENAI_BASE_URL` and model names are valid for your provider
4. The browser console and server log show a `POST /api/eval/subjective`

## 5. Application Structure

### Main routes

- `/`:
  - dashboard home and module browser
- `/login`:
  - credentials login page
- `/register`:
  - registration page
- `/eval/[id]`:
  - practice page for one unit
- `/review/[id]`:
  - pure reference / explanation page
- `/review/[id]?submissionId=...`:
  - review for one specific attempt
- `/dashboard/analytics`:
  - personal statistics page
- `/profile`:
  - profile and avatar management

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

## 6. Product Flows

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

## 7. Review Page Semantics

This is important.

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

## 8. Data Model Summary

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

## 9. Important Current Constraints

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

## 10. Useful Scripts

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

## 11. Recommended Working Rules For Contributors

- Do not assume `README.md` from older revisions is still correct
- Verify runtime behavior against code before changing product logic
- Be careful with review page semantics:
  - no `submissionId` = reference page
  - with `submissionId` = attempt review
- Do not expose AI provider keys in the frontend
- Prefer OpenAI-compatible provider configuration through environment variables
- For Writing and Speaking, keep auth checks both:
  - at entry page level
  - at API level

## 12. Near-Term Roadmap Ideas

These are not fully implemented yet, but they fit the current architecture:

- listening transcript highlighting with timestamps
- cloud ASR replacement for browser `SpeechRecognition`
- true realtime voice mode for Speaking
- richer writing review layout with strengths / weaknesses / rewrite suggestions
- reference answer management UI

