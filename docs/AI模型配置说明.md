# AI 模型配置说明

本文档说明 LinguoSovereign 里 AI 模型应该如何通过环境变量配置，以及当前项目对不同模型的分工。

最后更新：`2026-04-15`

## 1. 为什么要把模型名放进 `.env`

早期项目里，很多人只在 `.env` 里写：

- API Key
- Base URL

而把“具体模型名”直接写死在代码里。

这种做法能跑，但维护成本很高，原因很直接：

1. 切模型要改代码  
   你想从 `kimi-k2.5` 换到 `glm-4`，或者从旧版 Gemini 切到新版，就必须改源码并重新部署。

2. 开发 / 测试 / 生产环境不好区分  
   通常会出现：
   - 开发环境想用便宜一点的模型
   - 测试环境想试新模型
   - 生产环境想锁稳定版本  
   如果模型名写死在代码里，这种切换会很别扭。

3. 过一段时间后自己也会忘  
   你看到 `.env` 里只有 key，但不知道现在真实调用的是谁，这对排查问题非常不友好。

因此，当前项目已经统一调整为：

- `API key` 放 `.env`
- `base URL` 放 `.env`
- `model` 也放 `.env`
- 代码里只保留 fallback 默认值

## 2. 当前模型分工

### 2.1 写作评分

走 OpenAI-compatible 客户端。

可接：

- OpenAI 官方
- Moonshot / Kimi
- Zhipu / GLM4

### 2.2 口语转录评分

口语 transcript 评分现在优先支持 Gemini Flash-Lite。

如果没有配置 Gemini，再回退到 OpenAI-compatible。

原因：

- transcript 评分本质上是文本分析
- 不需要 Gemini Live 那种原生音频会话
- `gemini-3.1-flash-lite-preview` 很适合做结构化口语评分

### 2.3 阅读 AI 解析

走 OpenAI-compatible 客户端。

这个能力适合独立切模型，因为语法分析和长难句拆解不一定和写作评分用同一个模型最优。

### 2.4 口语自由对话

走 Gemini Live。

这里必须使用支持：

- `Live API`
- `Audio generation`

的实时语音模型。

当前推荐：

- `gemini-3.1-flash-live-preview`

## 3. 当前支持的环境变量

### 3.1 OpenAI-compatible

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_SPEAKING_EVAL_MODEL`
- `OPENAI_READING_ANALYSIS_MODEL`

### 3.2 GLM 兼容链路

- `GLM_API_KEY`
- `GLM_BASE_URL`
- `GLM_MODEL`
- `GLM_SPEAKING_EVAL_MODEL`
- `GLM_READING_ANALYSIS_MODEL`

### 3.3 Gemini

- `GEMINI_API_KEY`
- `GEMINI_SPEAKING_MODEL`
- `GEMINI_SPEAKING_EVAL_MODEL`
- `GEMINI_SPEAKING_TEXT_MODEL`

### 3.4 兼容旧变量名

当前代码仍兼容以下旧名字：

- `GEMINI_LIVE_MODEL`
- `GEMINI_CONVERSATION_MODEL`

但它们已经不是推荐写法。

以后建议统一写：

- `GEMINI_SPEAKING_MODEL`
- `GEMINI_SPEAKING_EVAL_MODEL`
- `GEMINI_SPEAKING_TEXT_MODEL`

## 4. 当前代码里的读取优先级

模型不会只看一个变量，而是按“优先级”读取。

### 4.1 写作评分模型

读取顺序：

1. `OPENAI_MODEL`
2. `GLM_MODEL`
3. 代码默认值 `gpt-4o-mini`

### 4.2 口语转录评分模型

读取顺序：

1. `GEMINI_SPEAKING_EVAL_MODEL`
2. `OPENAI_SPEAKING_EVAL_MODEL`
3. `GLM_SPEAKING_EVAL_MODEL`
4. 回退到写作评分模型

### 4.3 阅读 AI 解析模型

读取顺序：

1. `OPENAI_READING_ANALYSIS_MODEL`
2. `GLM_READING_ANALYSIS_MODEL`
3. 回退到写作评分模型

### 4.4 Gemini Live 口语自由对话模型

读取顺序：

1. `GEMINI_SPEAKING_MODEL`
2. `GEMINI_LIVE_MODEL`（兼容旧别名）
3. 默认值 `gemini-3.1-flash-live-preview`

### 4.5 Gemini 普通文本 speaking 会话模型

这个能力主要是为保留旧的 `streamGenerateContent` 兼容路径。

读取顺序：

1. `GEMINI_SPEAKING_TEXT_MODEL`
2. `GEMINI_CONVERSATION_MODEL`（兼容旧别名）
3. `GEMINI_SPEAKING_EVAL_MODEL`
4. 默认值 `gemini-3.1-flash-lite-preview`

### 4.6 Gemini speaking 非 live 评估模型

读取顺序：

1. `GEMINI_SPEAKING_EVAL_MODEL`
2. 回退到 `GEMINI_SPEAKING_TEXT_MODEL`
3. 再回退到默认值

## 5. 推荐配置写法

### 5.1 Kimi 写作 / 阅读 + Gemini 口语

这是当前很适合本项目的一种组合：

```env
OPENAI_API_KEY=your-moonshot-key
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=kimi-k2.5
OPENAI_READING_ANALYSIS_MODEL=kimi-k2.5

GEMINI_API_KEY=your-gemini-key
GEMINI_SPEAKING_MODEL=gemini-3.1-flash-live-preview
GEMINI_SPEAKING_EVAL_MODEL=gemini-3.1-flash-lite-preview
```

适用场景：

- 写作评分：Kimi
- 口语 transcript 评分：Gemini Flash-Lite
- 阅读 AI 解析：Kimi
- 口语自由对话：Gemini Live

### 5.2 GLM 写作 / 阅读 + Gemini 口语

```env
GLM_API_KEY=your-glm-key
GLM_BASE_URL=https://your-openai-compatible-glm-endpoint
GLM_MODEL=glm-4
GLM_READING_ANALYSIS_MODEL=glm-4

GEMINI_API_KEY=your-gemini-key
GEMINI_SPEAKING_MODEL=gemini-3.1-flash-live-preview
GEMINI_SPEAKING_EVAL_MODEL=gemini-3.1-flash-lite-preview
```

### 5.3 只用 OpenAI-compatible

如果你暂时不使用 Gemini Live，自由对话原生语音能力就不要开。

```env
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
OPENAI_SPEAKING_EVAL_MODEL=gpt-4o-mini
OPENAI_READING_ANALYSIS_MODEL=gpt-4o-mini
```

## 6. 当前代码里哪些文件会用到这些模型

### 6.1 核心读取文件

- [src/lib/ai.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/lib/ai.ts)

这个文件负责：

- 统一读取环境变量
- 统一提供模型名
- 创建 OpenAI-compatible 客户端
- 创建 Gemini Live token

### 6.2 写作 / 口语 transcript 评分

- [src/app/api/eval/subjective/route.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/app/api/eval/subjective/route.ts)

### 6.3 口语自由对话

- [src/app/api/speaking/live/route.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/app/api/speaking/live/route.ts)

### 6.4 阅读 AI 解析

- [src/app/api/reading/analysis/route.ts](/Users/ronaldlee/Desktop/LinguoSovereign/src/app/api/reading/analysis/route.ts)

## 7. 这次改动具体修了什么

这次主要修的是一个真实配置问题：

之前主要有两个问题：

- `GEMINI_SPEAKING_MODEL` 和 `GEMINI_LIVE_MODEL` 命名不统一
- 口语 transcript 评分没有把 Gemini 作为明确的第一优先级

现在已经统一为：

- Live 模型优先读 `GEMINI_SPEAKING_MODEL`
- `GEMINI_LIVE_MODEL` 只作为兼容旧配置的别名
- transcript 评分优先读 `GEMINI_SPEAKING_EVAL_MODEL`
- 不再需要额外再加一个 `GEMINI_TRANSCRIPT_EVAL_MODEL`

## 8. 推荐实践

### 建议

- 把模型名明确写进 `.env`
- 每条业务链路最好有独立模型位
- 开发环境打开 debug，直接看当前实际模型

### 不建议

- 只在代码里写死模型名
- `.env` 里只有 key，没有 model
- 口语 live 和 transcript 评分共用一个变量名但实际能力不同

## 9. 如果要排查“到底用的是哪个模型”

开发环境下，当前项目已经有 `Dev Debug` 面板。

你可以直接看：

- `backend.model`
- `backend.promptSource`
- `backend.promptPreview`

如果还要进一步确认，最稳的方法是：

1. 在 `.env` 里明确写模型名
2. 重启开发服务器
3. 打开对应页面
4. 发起一次请求
5. 看 debug 面板或终端日志

## 10. 总结

当前项目的模型配置原则已经改成：

- 模型选择优先走环境变量
- 代码只保留 fallback
- 旧变量名只做兼容，不再推荐继续使用

如果以后你再换模型，优先改 `.env`，不要先改代码。
