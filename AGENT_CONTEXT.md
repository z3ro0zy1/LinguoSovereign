# LinguoSovereign — AI Agent 快速上下文文档

> 本文档专为 AI Agent 编写，节省 token。**先读此文件，再读源码。**
> 最后更新：2026-03-07

---

## 1. 项目一句话

**LinguoSovereign（语言主权）** 是基于 Next.js 15 App Router 的 IELTS 全科备考平台，集成了 OpenAI GPT-4o 评分、Web Speech API 录音、PostgreSQL 题库（3000+ 条）。

---

## 2. 关键技术决策（避免踩坑）

| 决策     | 结论                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------- | ----------------------------------------- |
| 框架     | Next.js 15 + Turbopack，**用 App Router，不用 Pages Router**                                                                           |
| ORM      | Prisma 7（`prisma.config.ts` 在根目录，不是 `prisma/schema.prisma` 里的 datasource url）                                               |
| 认证     | NextAuth.js Credentials（邮箱+密码 bcrypt），**session 用 JWT 策略**                                                                   |
| 样式     | Tailwind CSS v4 + shadcn/ui（components.json 已配置）                                                                                  |
| DB存储   | 题目答案 `answer`、选项 `options`、解析 `officialAnalysis` 全部是 **Prisma `Json?` 类型**，实际值可能是 `string                        | string[] | {label, value} | null`，**绝对不能直接渲染为 React child** |
| 分类值   | `QuestionUnit.category` 的实际值是 `"Reading/Listening"`（两者合一）、`"Writing"`、`"Speaking"`，**不是** `"Reading"` 或 `"Listening"` |
| 音频 URL | DB 里存绝对路径，渲染时用 `/audios/${unit.audioUrl.split("/").pop()}` 取文件名                                                         |
| 试题区分 | 阅读 = `category === "Reading/Listening" && title.includes("Passage")`；听力 = 包含 `"Part"`                                           |

---

## 3. 目录结构（只列关键文件）

```
/
├── AGENT_CONTEXT.md          ← 本文件（AI 优先读）
├── this_task.md              ← 功能任务清单（Phase 1-5 全部 ✅）
├── this_walkthrough.md       ← 功能说明文档
├── docs/SystemArchitecture.md ← 详细架构说明
├── prisma/schema.prisma      ← 数据库模型
├── prisma.config.ts          ← Prisma 客户端配置（根目录）
├── .env                      ← DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY
│
├── src/app/
│   ├── page.tsx              → fetch allUnits → <DashboardClient>（首页）
│   ├── layout.tsx            → AuthProvider（SessionProvider）
│   ├── (auth)/login/         → 登录 UI
│   ├── (auth)/register/      → 注册 UI
│   ├── eval/[id]/page.tsx    → 答题页（Server → <EvalWrapper>）
│   ├── review/[id]/
│   │   ├── page.tsx          → Server Component：查询 unit+submission → <ReviewClient>
│   │   └── ReviewClient.tsx  → 详解页 Client（双栏布局、音频播放器、显示答案）
│   ├── profile/              → 个人资料 + 头像上传
│   ├── dashboard/analytics/  → Recharts 数据面板
│   └── api/
│       ├── eval/objective/   → 客观题批改 API
│       ├── eval/subjective/  → 主观题 GPT-4o 批改 API
│       ├── analytics/        → 成绩聚合（history[]）
│       ├── upload/           → 头像上传 → /public/uploads/
│       └── auth/[...nextauth]/ → NextAuth
│
├── src/components/
│   ├── DashboardClient.tsx   → 主仪表盘（993行）：导航栏、题库列表、历史记录 Dialog
│   └── eval/
│       ├── EvalWrapper.tsx   → category 路由分派（Writing/Speaking → Subjective；其余 → Objective）
│       ├── ObjectiveRenderer.tsx → 阅读/听力渲染器（1015行）
│       └── SubjectiveRenderer.tsx → 写作/口语渲染器
│
└── src/lib/
    ├── auth.ts               → NextAuth 配置（Credentials + JWT callbacks）
    ├── prisma.ts             → Prisma 单例（防重复连接）
    ├── testSession.ts        → localStorage 持久化工具（saveUnitState/getUnitState/clearUnitState）
    └── utils.ts              → formatIELTSTitle()、cn()
```

---

## 4. Prisma 数据模型（精简版）

```prisma
model QuestionUnit {
  id        String      // UUID
  sourceId  String      // 原始数据 ID
  title     String      // 如 "Cambridge 15 Test 1 Passage 1"
  audioUrl  String?     // 本地磁盘绝对路径，渲染时需转换
  category  String      // "Reading/Listening" | "Writing" | "Speaking"
  passage   Json        // [{english: "...", chinese: "..."}] 或 string[]
  questions Question[]
  submissions Submission[]
}
model Question {
  serialNumber     Int
  type             String   // "radio" | "checkbox" | "fill"
  stem             String   // 可含 {{response}} token 和 HTML
  options          Json?    // string[] 或 {label,value}[] ⚠️ 需 formatAnswer()
  answer           Json?    // string 或 string[] 或 {label,value} ⚠️ 需 formatAnswer()
  officialAnalysis Json?    // string 或 object ⚠️ 需 formatAnswer()
}
model Submission {
  userId    String?
  unitId    String
  answers   Json     // {questionId: string[]} — 用户答案 Map
  aiScore   Json?    // 客观题: {scoreRatio, results:[{questionId, isCorrect, userAnswer, subResults}]}
                     // 主观题: {TR, CC, LR, GRA, totalScore, summary}
  aiFeedback String? // Markdown 格式点评
}
model User { id, name, email, password(bcrypt'd), image }
```

---

## 5. 核心组件接口（避免查源码）

### `ObjectiveRenderer` props

```ts
{
  unit: (QuestionUnit & { questions },
    onResult,
    result,
    isLastPart,
    allFlowIds);
}
```

- `allFlowIds`: 全卷模式时相邻 Part 的 ID 数组，用于批量提交
- `result`: 评分后由 `onResult` 传入的 API 响应数据
- `isLastPart`: 是否显示"全卷提交"按钮

### `ReviewClient` props

```ts
{ unit: QuestionUnit & {questions}, submission: Submission|null, isObjective: boolean, calculatedScore: number }
```

### Analytics API 返回格式（`/api/analytics`）

```ts
{
  history: Array<{
    id;
    unitId;
    category;
    score: string;
    createdAt;
    // score 是浮点字符串，前端需 Math.round(parseFloat(score)*2)/2 转成 IELTS 格式
  }>;
}
```

---

## 6. 关键工具函数

```ts
// src/lib/utils.ts
formatIELTSTitle(rawTitle: string): string
// 将 "C15-T1-Passage1_新东方..." 转为 "Cambridge 15 Test 1 Passage 1"

// src/lib/testSession.ts
saveUnitState(unitId, category, reqIds, answers, timeSpent)
getUnitState(unitId): {answers, timeSpent, reqIds, category}
clearUnitState(unitId)

// src/app/review/[id]/ReviewClient.tsx（局部工具函数）
formatAnswer(answer: any): string
// 安全序列化 Prisma Json? 字段，处理 string/string[]/{label,value}/null 所有情况
```

---

## 7. ⚠️ 已知陷阱与规范

### 数据安全渲染（最重要）

所有渲染 `q.answer`、`q.options[]`、`q.officialAnalysis`、`resData.userAnswer` 的地方，
**必须经过 `formatAnswer()` 序列化**，直接 `{q.answer}` 会导致：

```
Error: Objects are not valid as a React child (found: object with keys {label, value})
```

### isObjective 判断

```ts
// ✅ 正确
const isObjective =
  unit.category === "Reading" ||
  unit.category === "Listening" ||
  unit.category === "Reading/Listening";
// ❌ 错误（DB 里不存 "Reading" 或 "Listening" 单独值）
const isObjective =
  unit.category === "Reading" || unit.category === "Listening";
```

### Review 页 submissionId 传参

```ts
// ✅ 历史记录详解链接应带 submissionId
href={`/review/${u.id}?submissionId=${attempt.id}`}
// ❌ 不带则永远只显示最新提交
href={`/review/${u.id}`}
```

### 音频 URL 渲染

```ts
// ✅ 取文件名
src={`/audios/${unit.audioUrl.split("/").pop()}`}
// ❌ 直接用绝对路径
src={unit.audioUrl}
```

### NextAuth Session 更新

更新用户资料后，前端必须调用 `update({name, image})` 触发 JWT 刷新，
否则 Navbar 头像不会更新。完整链路：
`ProfileClient → POST /api/upload → update() → auth.ts jwt() callback`

---

## 8. API 端点速查

| 端点                   | 方法 | 用途                                                 |
| ---------------------- | ---- | ---------------------------------------------------- |
| `/api/eval/objective`  | POST | 批改客观题，body: `{unitId, userAnswers, timeSpent}` |
| `/api/eval/subjective` | POST | GPT-4o 批改主观题，同上                              |
| `/api/analytics`       | GET  | 获取当前用户所有提交历史                             |
| `/api/upload`          | POST | 头像上传，FormData，存到 `/public/uploads/`          |
| `/api/auth/session`    | GET  | NextAuth 标准 session 端点                           |

---

## 9. 当前完成状态（Phase 1-5 全部 ✅）

- ✅ 客观题双栏渲染（拖拽分割、荧光笔、多选限制）
- ✅ 主观题 AI 评分（TR/CC/LR/GRA 四维度）
- ✅ localStorage 状态恢复（AlertDialog）
- ✅ 全卷批量提交
- ✅ NextAuth Credentials 认证
- ✅ 头像本地上传
- ✅ 成绩聚合 API + Recharts 图表
- ✅ Dashboard 历史记录表格 + Dialog
- ✅ Review 详解页（双栏、音频播放器、显示/隐藏答案、题目解析折叠）
- ✅ BUG FIX: isObjective 判断修正
- ✅ BUG FIX: Review 页所有 Json? 字段用 formatAnswer() 安全渲染
- ✅ BUG FIX: 历史记录 submissionId 精准传参

---

## 10. 常见任务快速参考

**添加新 API 路由** → `src/app/api/[name]/route.ts`，使用 `import { prisma } from "@/lib/prisma"`

**修改数据库 Schema** → 编辑 `prisma/schema.prisma` → `npx prisma migrate dev`

**添加新 shadcn 组件** → `npx shadcn-ui@latest add [组件名]`

**调试 500 错误** → 先检查渲染的 Json? 字段是否经过序列化

**运行开发服务器** → `npm run dev`（已在运行：`localhost:3000`）

**数据库入库** → `npx ts-node scripts/seed.ts`（或查看 scripts/ 目录）
