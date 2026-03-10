# LinguoSovereign — Agent Context

Last updated: 2026-03-09

This file is the AI-agent-facing source of truth for this repository.
Read this before making code changes.

## 1. Project Identity

LinguoSovereign is a Next.js 16 IELTS practice system with:

- objective modules: Reading / Listening
- subjective modules: Writing / Speaking
- attempt persistence
- review pages
- analytics
- auth-gated AI evaluation for subjective tasks

## 2. Ground Truth Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind v4
- NextAuth v4 Credentials + JWT sessions
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL
- `openai` SDK for OpenAI-compatible model providers

Do not describe this repo as Next.js 15 or GPT-4o-only. Both are outdated.

## 3. High-Value Files

### Root

- `README.md`
- `AGENT_CONTEXT.md`
- `package.json`
- `prisma/schema.prisma`
- `.env.example`

### App routes

- `src/app/page.tsx`
- `src/app/eval/[id]/page.tsx`
- `src/app/review/[id]/page.tsx`
- `src/app/dashboard/analytics/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/ProfileClient.tsx`

### API routes

- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/eval/objective/route.ts`
- `src/app/api/eval/subjective/route.ts`
- `src/app/api/speaking/live/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/register/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/units/route.ts`
- `src/app/api/units/[id]/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/prompts/route.ts`

### Components

- `src/components/DashboardClient.tsx`
- `src/components/eval/EvalWrapper.tsx`
- `src/components/eval/ObjectiveRenderer.tsx`
- `src/components/eval/SubjectiveRenderer.tsx`
- `src/components/eval/SpeakingAiRenderer.tsx`
- `src/app/review/[id]/ReviewClient.tsx`
- `src/app/review/[id]/review-utils.tsx`
- `src/components/eval/objective/shared.tsx`

### Core libs

- `src/lib/auth.ts`
- `src/lib/ai.ts`
- `src/lib/prisma.ts`
- `src/lib/testSession.ts`
- `src/lib/utils.ts`

## 4. Current Product Semantics

### Auth rules

- Reading / Listening: can be opened anonymously
- Writing / Speaking: require auth before entering `/eval/[id]`
- Subjective APIs require auth
- `/api/speaking/live` requires auth

### Review rules

- `/review/[id]` = pure reference page
- `/review/[id]?submissionId=...` = one historical attempt
- Do not silently auto-load latest submission in the no-query review route

### Dashboard rules

- `Attempt History` links should carry `submissionId`
- standalone `详解` button should not carry `submissionId`

## 5. Data Model Facts

### `QuestionUnit`

Fields that matter most in code:

- `id: string`
- `sourceId: string`
- `title: string`
- `audioUrl: string | null`
- `category: string`
- `passage: Json`

### `Question`

- `serialNumber: number`
- `type: string`
- `stem: string`
- `options: Json?`
- `answer: Json?`
- `officialAnalysis: Json?`

### `Submission`

- `answers: Json`
  - current shape usually: `{ userAnswers, timeSpent }`
- `aiScore: Json?`
- `aiFeedback: string?`

## 6. Category Invariants

Database categories are not split as raw `Reading` and `Listening` in `QuestionUnit.category`.
The actual values are:

- `Reading/Listening`
- `Writing`
- `Speaking`

Reading vs Listening is derived from title:

- Reading if title contains `Passage`
- Listening if title contains `Part`

This inference exists in multiple places. Keep it consistent.

## 7. Current AI Layer

Defined in `src/lib/ai.ts`.

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_SPEAKING_MODEL`

Reality:

- the code uses the OpenAI SDK
- providers may be OpenAI-compatible third parties, including Moonshot / Kimi
- `getSubjectiveEvalModel()` is used for Writing / Speaking evaluation
- `getSpeakingConversationModel()` is used for speaking conversation mode

Do not hardcode provider-specific assumptions into UI copy unless requested.

## 8. Speaking Architecture

There are two speaking modes.

### Standard speaking practice

Implemented in `SubjectiveRenderer.tsx`.

Current stack:

- browser `SpeechRecognition` / `webkitSpeechRecognition`
- transcription into textarea-like answer state
- can also be typed manually

### AI speaking mode

Implemented in `SpeakingAiRenderer.tsx` + `/api/speaking/live`.

Current stack:

- browser speech recognition for input
- server-side text model call for examiner reply
- browser speech synthesis for playback

Important:

- this is not true full-duplex realtime voice
- it is a turn-based voice loop
- if docs mention WebRTC or realtime voice, they must be clearly marked as future work unless implemented

## 9. Objective Flow Facts

`src/app/api/eval/objective/route.ts`:

- saves submissions even when user is anonymous
- objective scoring is algorithmic
- `aiScore` for objective submissions stores metadata like:
  - `totalCorrect`
  - `totalObjective`
  - `scoreRatio`
  - `timeSpent`

`ReviewClient.tsx` uses these results to render correctness and explanation UI.

## 10. Subjective Flow Facts

`src/app/api/eval/subjective/route.ts`:

- requires auth
- supports two modes:
  - save only: `useAi = false`
  - AI evaluate: `useAi = true`
- AI output contract expects JSON with:
  - `totalScore`
  - `dimensions: { TR, CC, LR, GRA }`
  - `summary`

Current persistence detail:

- `aiScore` currently stores `aiParsed.dimensions` only
- `aiFeedback` stores `summary` or fallback text
- review pages derive total band by averaging dimensions if needed

If you refactor this, keep analytics and review compatibility in mind.

## 11. Review Rendering Facts

### Images

- image-heavy stems should use shared parse options
- `imageFixingOptions` lives in `src/components/eval/objective/shared.tsx`
- static asset normalization is centralized in `resolveStaticAssetUrl()` in `src/lib/utils.ts`

### AI markdown

- subjective review uses `parseRichAnswer()` from `src/app/review/[id]/review-utils.tsx`
- this now renders headings, lists, and bold text instead of raw markdown dumps

### User context section

- should show only the actual user response
- should not dump the full `submission.answers` object raw
- `timeSpent` and internal keys should stay out of the UI unless explicitly requested

### Reference answer box

- the reference area should still render even if `q.answer` is missing
- current placeholder is intentional until content is filled later

## 12. Listening Timestamp Status

No transcript timestamps currently exist.

Evidence:

- Prisma schema has no timestamp fields for transcript segments
- seeded `passage` is just JSON content without timing metadata
- current listening transcript rendering treats `passage` as plain text blocks

Therefore:

- audio-synced transcript highlighting is not possible yet without new data
- the hard problem is data preparation, not the highlight UI itself

## 13. Auth Details

`src/lib/auth.ts` uses:

- Credentials provider
- bcrypt password comparison
- JWT session strategy
- session callback exposes `user.id`

Login page details:

- `/login` accepts `callbackUrl`
- after successful sign-in it redirects back via `router.replace(callbackUrl)`

## 14. Local Persistence

`src/lib/testSession.ts` manages local draft state through `localStorage`.

Used for:

- answer persistence
- draft restoration
- per-unit state

Keys include:

- `linguo_ans_[unitId]`
- `linguo_req_[unitId]`
- `linguo_cat_[unitId]`
- `linguo_time_[unitId]`

## 15. Known Current Limitations

- no listening transcript timestamps
- no full realtime voice stack
- speaking standard mode still depends on browser speech APIs
- reference answers are incomplete for some subjective tasks
- `DashboardClient.tsx` remains large and should still be treated carefully

## 16. Common Failure Modes

### NextAuth JWT decryption error

Usually caused by stale cookies after changing `NEXTAUTH_SECRET`.
Fix by clearing site data for `localhost:3000`.

### Subjective AI request appears to do nothing

Historically caused by UI overlap and by task-batch submission assumptions.
Current intended behavior:

- standalone Writing / Speaking entry submits the current unit only
- full flow submission still uses the explicit `flow` sequence when present

### Review image not loading

Usually caused by raw image path rendering instead of `resolveStaticAssetUrl()`.

## 17. Safe Editing Guidelines

When changing this repo, prefer these rules:

- do not infer behavior from old docs
- verify route semantics in code first
- keep auth checks aligned between page and API
- treat `Json` fields as untrusted shape
- do not render raw Prisma JSON directly into React
- preserve the distinction between:
  - pure reference review
  - historical attempt review

## 18. Quick Commands

```bash
npm run dev
npm run lint
npm run build
npx tsx scripts/seed.ts
npx tsx scripts/verify_audio_files.ts
npx tsx scripts/debug_analytics_categories.ts
```

