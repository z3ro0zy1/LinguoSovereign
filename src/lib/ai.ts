/**
 * AI 能力统一出口
 * 这个文件现在同时承载三类模型能力：
 * 1. OpenAI-compatible：写作评分、口语转录评分（目前可接 Kimi 2.5）
 * 2. Gemini 常规文本/多模态请求：Flash-Lite 这类 generateContent / streamGenerateContent
 * 3. Gemini Live：自由对话的原生音频实时会话
 *
 * 这样做的目的只有一个：把“模型选择”和“接口调用方式”集中起来，避免 route 层散落一堆 SDK 细节。
 */
import OpenAI from "openai";
import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
const DEFAULT_GEMINI_LIVE_TOKEN_USES = 5;

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

type GeminiGenerateRequest = {
  systemInstruction?: string;
  contents: Array<{
    role: "user" | "model";
    parts: GeminiPart[];
  }>;
  responseMimeType?: string;
};

type GeminiLiveTokenRequest = {
  systemInstruction: string;
};

function getOpenAiApiKey() {
  /**
   * 主观题评分统一走 OpenAI-compatible 协议。
   * 这样同一套客户端可以无缝切换：
   * - OpenAI
   * - Moonshot / Kimi
   * - Zhipu GLM4
   *
   * 预留 GLM4 的方式不是再起一套 SDK，
   * 而是直接兼容它的 API Key / Base URL / Model 环境变量。
   */
  const apiKey = process.env.OPENAI_API_KEY || process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI 服务未配置。请在 .env 文件中设置 OPENAI_API_KEY 或 GLM_API_KEY 以开启主观题评分功能。",
    );
  }
  return apiKey;
}

function getGeminiApiKey() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_SPEAKING_API ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini 服务未配置。请在 .env 文件中设置 GEMINI_API_KEY 以开启口语训练功能。",
    );
  }
  return apiKey;
}

function getGeminiBaseUrl() {
  return process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL;
}

function getGeminiTimeoutMs() {
  const value = Number(process.env.GEMINI_TIMEOUT_MS || DEFAULT_GEMINI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GEMINI_TIMEOUT_MS;
}

/**
 * Live API 走的是独立的实时音频模型，不应该继续复用 Flash-Lite。
 * 这里单独给它一组默认值，便于后续在 .env 里切换版本。
 */
function getGeminiLiveModelName() {
  return process.env.GEMINI_LIVE_MODEL || DEFAULT_GEMINI_LIVE_MODEL;
}

function getGeminiLiveTokenUses() {
  const value = Number(
    process.env.GEMINI_LIVE_TOKEN_USES || DEFAULT_GEMINI_LIVE_TOKEN_USES,
  );
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GEMINI_LIVE_TOKEN_USES;
}

async function fetchGemini(path: string, body: object, isStreaming = false) {
  // 常规 Gemini HTTP 请求统一从这里走，方便统一超时、baseURL 和错误信息。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getGeminiTimeoutMs());

  try {
    const response = await fetch(
      `${getGeminiBaseUrl()}${path}${path.includes("?") ? "&" : "?"}key=${getGeminiApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Gemini request failed");
    }

    if (isStreaming && !response.body) {
      throw new Error("Gemini streaming body is empty");
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Gemini request timed out after ${getGeminiTimeoutMs()}ms. Check network access or configure GEMINI_BASE_URL.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getAiClient() {
  return new OpenAI({
    apiKey: getOpenAiApiKey(),
    baseURL:
      process.env.OPENAI_BASE_URL ||
      process.env.GLM_BASE_URL ||
      undefined,
  });
}

export function getSubjectiveEvalModel() {
  return (
    process.env.OPENAI_MODEL ||
    process.env.GLM_MODEL ||
    DEFAULT_OPENAI_MODEL
  );
}

export function getSpeakingTranscriptEvalModel() {
  return (
    process.env.OPENAI_SPEAKING_EVAL_MODEL ||
    process.env.GLM_SPEAKING_EVAL_MODEL ||
    getSubjectiveEvalModel()
  );
}

/**
 * 阅读长难句分析和段落讲解可以独立切模型。
 * 这样后面如果你觉得 GLM4 在语法拆解上更稳，不需要影响写作/口语评分链路。
 */
export function getReadingAnalysisModel() {
  return (
    process.env.OPENAI_READING_ANALYSIS_MODEL ||
    process.env.GLM_READING_ANALYSIS_MODEL ||
    getSubjectiveEvalModel()
  );
}

export function getSpeakingConversationModel() {
  return process.env.GEMINI_SPEAKING_MODEL || DEFAULT_GEMINI_MODEL;
}

export function getSpeakingEvaluationModel() {
  return process.env.GEMINI_SPEAKING_EVAL_MODEL || getSpeakingConversationModel();
}

/**
 * 自由对话的原生音频会话模型。
 * 这里和“文本生成 / 转录评分”故意拆开，避免误把 Flash-Lite 当 Live 音频模型用。
 */
export function getSpeakingLiveModel() {
  return getGeminiLiveModelName();
}

function buildGeminiRequestBody(request: GeminiGenerateRequest) {
  // Gemini 的原生 REST 字段是 snake_case，这里做一次项目内部 -> Gemini 请求体的转换。
  return {
    system_instruction: request.systemInstruction
      ? {
          parts: [{ text: request.systemInstruction }],
        }
      : undefined,
    contents: request.contents,
    generationConfig: request.responseMimeType
      ? { responseMimeType: request.responseMimeType }
      : undefined,
  };
}

export async function generateGeminiContent(request: GeminiGenerateRequest) {
  // 这个函数面向“一次性得到完整文本结果”的场景，例如转录、总结、结构化抽取。
  const model = getSpeakingEvaluationModel();
  const response = await fetchGemini(
    `/v1beta/models/${model}:generateContent`,
    buildGeminiRequestBody(request),
  );

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || ""
  );
}

export async function streamGeminiContent(
  request: GeminiGenerateRequest,
): Promise<ReadableStream<Uint8Array>> {
  // 这个函数只保留给普通 SSE 文本流使用，不再承担 Live 音频会话职责。
  const model = getSpeakingConversationModel();
  const response = await fetchGemini(
    `/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    buildGeminiRequestBody(request),
    true,
  );

  return response.body as ReadableStream<Uint8Array>;
}

/**
 * 创建一个短期可复用的 Live API token。
 * 设计要点：
 * 1. token 只给 Live 语音会话使用，不暴露长期 API key 到前端。
 * 2. token 内直接锁定 Live 会话的关键配置，减少前端乱配造成的不可控差异。
 * 3. uses 允许同一页面内“停止后继续”重新建会话，而不用每次都重新换 token。
 */
export async function createGeminiLiveToken(request: GeminiLiveTokenRequest) {
  const client = new GoogleGenAI({
    apiKey: getGeminiApiKey(),
    httpOptions: { apiVersion: "v1alpha" },
  });

  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: request.systemInstruction,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        prefixPaddingMs: 80,
        silenceDurationMs: 900,
      },
    },
  };

  const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const token = await client.authTokens.create({
    config: {
      uses: getGeminiLiveTokenUses(),
      newSessionExpireTime,
      expireTime,
      liveConnectConstraints: {
        model: getSpeakingLiveModel(),
        config: liveConfig,
      },
      // 这些字段在 token 里锁定，避免前端把会话改回 TEXT 模式或移除关键转录配置。
      lockAdditionalFields: [
        "model",
        "responseModalities",
        "systemInstruction",
        "inputAudioTranscription",
        "outputAudioTranscription",
        "realtimeInputConfig",
      ],
    },
  });

  if (!token.name) {
    throw new Error("Gemini Live token creation returned an empty token.");
  }

  return {
    token: token.name,
    model: getSpeakingLiveModel(),
  };
}
