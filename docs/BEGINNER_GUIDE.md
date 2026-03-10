# LinguoSovereign 小白指南

这份文档是给第一次接触这个项目的人看的。

你不需要先懂 Next.js、Prisma、API 路由，先把这份文档看完，就能知道：

- 这个应用是做什么的
- 用户是怎么一步步使用它的
- 页面里不同区域大概在做什么
- 代码里常见“组件 / 页面 / API”分别承担什么职责
- 以后你想继续改功能，应该先看哪里

如果你是 AI agent，请优先阅读 [../AGENT_CONTEXT.md](../AGENT_CONTEXT.md)。

## 1. 这个应用到底是什么

LinguoSovereign 是一个雅思练习平台，主要分成四个模块：

- 阅读 Reading
- 听力 Listening
- 写作 Writing
- 口语 Speaking

它不只是“做题页”，而是一整条练习工作流：

1. 从首页进入某个模块
2. 找到题目并开始作答
3. 提交答案
4. 查看题目解析 / 历史记录 / AI 反馈
5. 回到数据页复盘自己的表现

你可以把它理解成：

- `题库系统`：存放阅读、听力、写作、口语题目
- `练习系统`：负责作答、保存草稿、提交答案
- `评估系统`：负责客观题判对错、主观题 AI 评语
- `复盘系统`：负责历史记录、详解、数据统计

## 2. 普通用户是怎么使用它的

### 首页工作流

用户进入首页后，会先看到四个模块卡片：

- 模考阅读
- 自动听力
- 精批写作
- 流式口语

这四张卡就是四个主入口。

点击之后，页面会进入该模块下的题组列表，比如：

- Reading 会看到某本书、某个 Test 下的 Part 题组
- Writing 会看到 Task 1 / Task 2
- Speaking 会看到 Part 1 / Part 2 / Part 3

### 不同模块的登录规则

这个项目不是所有模块都强制登录。

#### 可以不登录直接做的

- Reading
- Listening

这两个模块属于客观题训练，就算不登录，也可以直接进入题目页练习。

#### 必须先登录再进入的

- Writing
- Speaking

因为这两个模块会涉及：

- 保存用户文本 / 语音输入
- AI 判分
- 历史记录
- 个性化复盘

所以用户一旦点击写作或口语的开始入口，系统会先要求登录。登录成功后，再自动回到刚才那道题。

## 3. 四个模块分别在做什么

### 3.1 Reading

Reading 是阅读客观题模块。

用户会看到：

- 左边或上方是文章 / 题目材料
- 右边或下方是问题区
- 页面底部或侧边有题号导航

用户作答后：

- 提交到后端
- 系统计算对错
- 进入 review 页面查看解析

这个模块的核心特点是：

- 不需要 AI 判分
- 重点是题目呈现、答案保存、提交判分、错题复盘

### 3.2 Listening

Listening 和 Reading 类似，但多了音频。

用户会看到：

- 音频播放器
- transcript 或听力材料区域
- 题目区域
- 题号导航

它的工作流程是：

1. 进入题目页
2. 播放音频并作答
3. 提交客观题答案
4. 在 review 页面查看答案与解析

当前项目里，听力 transcript 只有文本，没有时间戳，所以还做不到“音频播到哪，文本就自动高亮到哪”。

### 3.3 Writing

Writing 是主观题模块。

用户会看到：

- 左侧题目区：题干、图片、写作要求
- 右侧作答区：文本输入框、字数统计
- 底部切换：Task 1 / Task 2（如果这套题有多个写作 task）

Writing 有两种提交方式：

- `普通提交`
  - 只是把当前答案保存下来
  - 不调用 AI
- `AI 判分并给建议`
  - 把答案发送给后端
  - 后端调用 AI 给出 Band 评分和反馈

提交后，用户可以在历史记录中查看：

- 第几次练习
- 该次分数
- 进入对应的 review 页面

### 3.4 Speaking

Speaking 也是主观题模块，但输入方式更复杂。

目前项目有两种模式：

- `开始训练`
  - 更接近普通口语练习
  - 现在主要依赖浏览器的语音转文字能力
- `AI 模式`
  - 模拟一个考官和用户进行来回对话
  - 用户说一句，系统回一句

当前 speaking 还不是真正 WebRTC 意义上的全双工实时语音系统。现在更像：

1. 浏览器识别用户语音
2. 后端把文本发给模型
3. 模型返回文本
4. 浏览器再把文本播报出来

也就是说，它已经有“对话感”，但还不是“电话通话级别”的实时语音流。

## 4. 首页、题目页、详解页、历史页分别是什么关系

这是最容易让新同学混淆的地方。

### 首页 Dashboard

首页不是单纯展示卡片，它是整个练习流程的起点。

它承担三件事：

- 模块入口
- 题组列表入口
- 历史与数据入口

一个典型动作是：

1. 在首页点击“精批写作”
2. 找到某个 Test 的 Task 1
3. 点击“开始作答”
4. 做完以后回首页看这题的历史次数和最近分数

### Eval 页

`/eval/[id]` 就是做题页。

这个页面负责：

- 把题目内容渲染出来
- 接住用户输入
- 自动保存草稿
- 提交到后端

这里是“训练进行中”的页面。

### Review 页

`/review/[id]` 是“纯题目详解页”。

它应该展示的是：

- 题目
- 图片 / 音频 / transcript
- 参考答案区域
- 官方解析区域

它不应该默认带着某一次作答历史。

### 某次作答回顾页

`/review/[id]?submissionId=...` 是“某一次提交记录的回顾页”。

这个页面除了题目本身，还会显示：

- 该次用户答案
- 当时的分数
- AI 反馈
- 当次提交对应的上下文

所以你可以简单记住：

- 不带 `submissionId`：题目详解
- 带 `submissionId`：历史作答回顾

## 5. 代码里最重要的几类东西

这个项目如果从代码结构上看，主要分成 5 层。

### 5.1 `src/app`：页面与路由层

这是 Next.js App Router 的页面目录。

你可以把它理解成“每个 URL 对应哪个页面”。

常见目录包括：

- `src/app/page.tsx`
  - 首页
- `src/app/eval/[id]/page.tsx`
  - 做题页入口
- `src/app/review/[id]/page.tsx`
  - 详解页入口
- `src/app/dashboard/analytics/page.tsx`
  - 数据分析页
- `src/app/profile/page.tsx`
  - 个人资料页
- `src/app/(auth)/login/page.tsx`
  - 登录页

简单说：

- `app` 里主要决定“去哪个页面”
- 具体页面长什么样，通常再交给组件层去做

### 5.2 `src/components`：界面组件层

这里放的是页面真正会用到的 UI 组件。

最关键的一批在：

- `src/components/DashboardClient.tsx`
  - 首页大部分真实交互都在这里
- `src/components/eval/ObjectiveRenderer.tsx`
  - 阅读 / 听力这类客观题怎么渲染
- `src/components/eval/SubjectiveRenderer.tsx`
  - 写作 / 普通口语练习怎么渲染
- `src/components/eval/SpeakingAiRenderer.tsx`
  - 口语 AI 模式界面

你可以把这些组件理解成“页面真正的主角”。

页面文件只是把数据准备好，再把这些组件挂上去。

### 5.3 `src/app/api`：后端接口层

这是 Next.js 自带的 API 路由。

当前项目最关键的几个接口：

- `src/app/api/eval/objective/route.ts`
  - 客观题提交与判分
- `src/app/api/eval/subjective/route.ts`
  - 主观题保存 / AI 判分
- `src/app/api/speaking/live/route.ts`
  - 口语 AI 对话
- `src/app/api/analytics/route.ts`
  - 数据统计
- `src/app/api/auth/[...nextauth]/route.ts`
  - 登录鉴权

这些接口的作用是：

- 接收前端提交的数据
- 和数据库交互
- 调用 AI 服务
- 把结果再返回前端

### 5.4 `src/lib`：基础能力层

这里放的是“很多页面和接口都会用到的公共能力”。

常见的包括：

- `src/lib/auth.ts`
  - 登录鉴权相关配置
- `src/lib/ai.ts`
  - 统一调用 AI provider
- `src/lib/testSession.ts`
  - 本地草稿 / 测试状态保存逻辑
- `src/lib/utils.ts`
  - 路径处理、文本处理等通用工具

可以把 `lib` 理解成“底盘工具箱”。

### 5.5 `prisma` 和数据库

数据库决定：

- 题目怎么存
- 提交记录怎么存
- 用户怎么存
- 成绩怎么存

简单理解几个核心概念：

- `QuestionUnit`
  - 一道可进入作答的训练单元
  - 比如 Reading 的一个 Part，Writing 的一个 Task
- `Question`
  - 单个问题
- `Submission`
  - 用户的一次提交记录
- `User`
  - 用户账号

如果你只是改 UI，不一定要碰数据库。
如果你要加“新数据字段”“新评分结果”“新时间轴能力”，就常常会动到 Prisma。

## 6. 一个完整请求是怎么跑起来的

这里举两个最典型的例子。

### 例子 1：阅读提交

1. 用户在首页选中阅读某题组
2. 进入 `/eval/[id]`
3. 页面加载题目和问题
4. 用户填写答案
5. 点击提交
6. 前端调用 `/api/eval/objective`
7. 后端计算对错并保存 submission
8. 页面跳去 review 或显示结果

### 例子 2：写作 AI 判分

1. 用户登录
2. 进入某道 Writing 题目页
3. 在右侧文本框写作文
4. 点击 `AI 判分并给建议`
5. 前端调用 `/api/eval/subjective`
6. 后端保存答案
7. 后端调用 `src/lib/ai.ts` 里的模型请求
8. AI 返回 TR / CC / LR / GRA 和总结反馈
9. 页面显示总分、四维评分、AI 评语
10. 这次结果也会进入历史记录

## 7. 你在页面里看到的常见区块是什么意思

### `Latest Score`

表示这道题最近一次有分数的结果。

注意：

- 如果只是普通保存，没有 AI 判分
- 那么它可能显示“未评估”或没有分数

### `Attempt History`

表示这道题一共提交过多少次。

点进去通常会看到：

- 第几次练习
- 时间
- Band 分数
- 进入某次历史回顾页

### `详解`

这里指的是“题目详解页”，不是你的作答记录。

它应该展示：

- 原题
- 参考答案占位区
- 官方解析

### `Your Context / Response`

这个区块应该展示用户当次提交的答案内容。

它不应该把整个原始 JSON 原样扔出来。现在项目已经在往“只显示用户答案本身”的方向整理。

## 8. 这个项目当前已经实现了什么，哪些还没有

### 已经比较稳定的

- 四大模块首页入口
- Reading / Listening 客观题提交流程
- Writing 普通提交和 AI 判分
- Speaking 普通训练和 AI 模式的基础形态
- Dashboard 历史记录和 Analytics
- Review 页的题目 / 历史两种语义分离

### 还没有完全做完的

- 听力 transcript 按时间轴高亮
- 真正 WebRTC 级别的实时语音口语
- 全量参考答案内容维护
- 更细颗粒度的内容管理后台

## 9. 如果你以后要改功能，先从哪里看

### 想改首页

先看：

- `src/app/page.tsx`
- `src/components/DashboardClient.tsx`

### 想改阅读 / 听力做题体验

先看：

- `src/app/eval/[id]/page.tsx`
- `src/components/eval/ObjectiveRenderer.tsx`
- `src/components/eval/objective/`

### 想改写作 / 口语体验

先看：

- `src/components/eval/SubjectiveRenderer.tsx`
- `src/components/eval/SpeakingAiRenderer.tsx`
- `src/app/api/eval/subjective/route.ts`
- `src/app/api/speaking/live/route.ts`

### 想改 AI provider

先看：

- `src/lib/ai.ts`
- `.env`
- `.env.example`

### 想改登录逻辑

先看：

- `src/lib/auth.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`

## 10. 给完全不懂代码的人一个最短记忆版

你可以只记住下面这张“脑图”：

- 首页：选模块、看历史、进数据页
- Eval 页：真正做题
- API：接收提交、保存数据、调 AI
- Review 页：看详解或看某次历史回顾
- Analytics：看统计
- Profile：改个人资料
- `lib`：公共工具和底层能力
- `prisma`：数据库结构

如果你以后又忘了这个项目怎么跑，先重新看这 4 个文件：

- `README.md`
- `docs/BEGINNER_GUIDE.md`
- `AGENT_CONTEXT.md`
- `src/components/DashboardClient.tsx`
