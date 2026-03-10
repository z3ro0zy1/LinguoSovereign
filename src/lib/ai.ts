/**
 * AI 服务配置文件 (AI Service Configuration)
 * 作用：初始化 OpenAI 客户端，定义用于评分和对话的 AI 模型。
 */

import OpenAI from "openai";

// 默认使用的 AI 模型（性能好且价格便宜的模型）
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/**
 * 获取 AI 客户端实例
 * 作用：创建一个可以向 OpenAI 发送请求的对象。
 */
export function getAiClient() {
  const apiKey = process.env.OPENAI_API_KEY; // 从环境变量获取 API 密钥

  // 1. 安全检查：如果没配置密钥，直接报错提醒
  if (!apiKey) {
    throw new Error(
      "AI 服务未配置。请在 .env 文件中设置 OPENAI_API_KEY 以开启写作/口语自动评分功能。",
    );
  }

  // 2. 创建并返回 OpenAI 对象
  return new OpenAI({
    apiKey,
    // 如果你在国内使用转发 API，可以配置这个地址，否则默认连 OpenAI 官方
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

/**
 * 获取用于“主观题逻辑”评估的模型名称 (比如作文批改)
 */
export function getSubjectiveEvalModel() {
  // 优先用环境变量里的配置，没有就用默认的 gpt-4o-mini
  return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

/**
 * 获取用于“口语实时对话”的模型名称
 */
export function getSpeakingConversationModel() {
  // 优先用口语专用的模型配置，没有就沿用主观评估模型
  return process.env.OPENAI_SPEAKING_MODEL || getSubjectiveEvalModel();
}
