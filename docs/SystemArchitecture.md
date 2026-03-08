# LinguoSovereign (语言主权) System Architecture

LinguoSovereign is a modern, Next.js (App Router) based web application designed for IELTS preparation. It provides a robust evaluation pipeline balancing deterministic grading for objective questions (Reading/Listening) and AI-driven grading via OpenAI for subjective questions (Writing/Speaking).

## 1. Tech Stack Overview

- **Framework**: Next.js 14/15 (App Router) with React 18+
- **Styling**: Tailwind CSS + Shadcn UI components for headless accessible UI.
- **Database**: PostgreSQL (managed locally or via cloud).
- **ORM**: Prisma for strongly-typed database queries.
- **AI Integration**: OpenAI SDK (`gpt-4o`) for essay and speech evaluation.
- **Browser APIs**: Web Speech API (`window.SpeechRecognition`) for local real-time speech dictation.

---

## 2. Core Components & Renderers

The frontend exam experience revolves around the `EvalWrapper` component, which acts as a traffic controller, delegating the complex UI rendering logic depending on the `QuestionUnit` category.

### 2.1 `EvalWrapper` (`src/components/eval/EvalWrapper.tsx`)

- **Role**: The main container for an ongoing test.
- **State**: Maintains `submissionResult` which tracks if the user is currently taking the test (`null`) or reviewing the result (populated object).
- **Delegation**: Checks `unit.category`.
  - If `Reading/Listening`, delegates to `ObjectiveRenderer`.
  - If `Writing/Speaking`, delegates to `SubjectiveRenderer`.

### 2.2 `ObjectiveRenderer` (`src/components/eval/ObjectiveRenderer.tsx`)

- **Role**: Renders tests with deterministic True/False answers.
- **Key Features**:
  - **Timer Logic**: A countdown for Reading and a count-up for Listening.
  - **Dynamic Input Parsing**: Uses `html-react-parser` to parse raw HTML stems scraped from our JSON database. It locates the `{{response}}` token and dynamically explicitly injects a React `<input>` tag into the DOM string.
  - **Multi-Select vs Single-Select**: Dynamically shifts between `radio` buttons and `checkboxes` depending on whether `q.answer` contains more than one valid array value.
  - **Feedback Highlight**: In review mode, it highlights fields green/red and renders inline official text showing exactly what was expected.

### 2.3 `SubjectiveRenderer` (`src/components/eval/SubjectiveRenderer.tsx`)

- **Role**: Handles unstructured user answers (long-form texts or speech).
- **Key Features**:
  - **Pagination**: IELTS Speaking often consists of Part 1, Part 2, and Part 3. The state `currentStep` manages rendering one question at a time.
  - **Dictation**: Binds the native `webkitSpeechRecognition` API. When "Start Recording" is active, it captures voice, converts it to string data inline, and injects it sequentially into the text area.
  - **AI Feedback Presentation**: Upon clicking "Submit", heavily styled cards render the LLM's scores (TR, CC, LR, GRA) alongside a multi-paragraph Markdown feedback block.

---

## 3. Backend API & Evaluation Routers

LinguoSovereign pushes the heavy lifting to Next.js API Routes rather than the client to protect secrets (like OpenAI API keys) and safely interact with Prisma.

### 3.1 Objective Evaluation (`src/app/api/eval/objective/route.ts`)

- **Logic Sequence**:
  1. Receives an object mapping Question IDs to an array of user inputs.
  2. Fetches the `QuestionUnit` directly from Prisma to prevent client-side answer tampering.
  3. Iterates over sub-questions. Handles alternate official answers formatted via semicolon (e.g. `True; T`).
  4. Returns a JSON dictionary breaking down specific `isCorrect` booleans for every specific blank.

### 3.2 Subjective Evaluation (`src/app/api/eval/subjective/route.ts`)

- **Logic Sequence**:
  1. Combines the original HTML test prompt with whatever text the user submitted.
  2. Pulls an appropriate system instructions prompt (the `UserPrompt` schema) dictating the AI's grading rubric.
  3. POSTs to `OpenAI`. Instructs the model using `response_format: { type: "json_object" }` to ensure it always successfully parses standard keys: `{ totalScore, dimensions: { TR, CC, LR, GRA }, summary }`.
  4. Saves the resultant AI payload directly into a `Submission` Postgres record.

---

## 4. Data Layer & Assets

### 4.1 Prisma Schema & Database

The project utilizes a relational database mapped via `prisma/schema.prisma`:

- `QuestionUnit`: The parent entity (e.g., "Cambridge 10, Test 1, Passage 1").
- `Question`: Belongs to a unit. Contains the individual question `stem` and multiple `options`.
- `Submission`: Logs the user's exam performance indefinitely. Allows users to pull up historical tests.

### 4.2 Local Assets

Assets like embedded HTML images (`<img src="/images/xxx.png">`) and `audioUrl` are served directly via the `public/` directory within traditional Next.js paradigms. Scaffolding scripts (`scripts/link_audios.ts`) exist to map local disk filenames onto the SQL entries automatically.
