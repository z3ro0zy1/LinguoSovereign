import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAiClient,
  getSpeakingTranscriptEvalModel,
  getSubjectiveEvalModel,
} from "@/lib/ai";

/**
 * 主观题评分统一落成维度键值表。
 *
 * 写作和口语的维度不同，因此这里不用写死联合类型，
 * 让同一套落库和前端展示逻辑都能复用。
 */
type SubjectiveDimensions = Record<string, number | string>;

/**
 * 前端提交主观题时允许同时带：
 * - promptId: 当前选择的数据库 prompt
 * - promptContent: 用户在前端编辑后的即时版本
 *
 * 后端会优先使用 promptContent，这样用户不需要先保存 prompt 才能立即试效果。
 */
type EvalBody = {
  unitId?: string;
  userAnswers?: Record<string, string>;
  promptId?: string;
  promptContent?: string;
  timeSpent?: number;
  useAi?: boolean;
};

const FALLBACK_PROMPTS = {
  writing:
    "You are a professional IELTS examiner. Evaluate the candidate response with clear band-style judgement and specific improvement advice.",
  speakingTranscript:
    "You are an IELTS speaking examiner. Evaluate the learner using IELTS speaking dimensions only.",
};

// 兜底解析模型返回，避免模型偶发输出非 JSON 时整个接口直接失败。
function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value) as {
      totalScore?: number;
      dimensions?: SubjectiveDimensions;
      summary?: string;
    };
  } catch {
    return { summary: value };
  }
}

// 如果模型没给 totalScore，就按维度分计算一个标准化总分。
function getAverageBand(dimensions: SubjectiveDimensions | undefined) {
  const scores = Object.values(dimensions || {})
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => !Number.isNaN(value));

  if (!scores.length) return null;
  return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 2) / 2;
}

// 口语“转录评分”模式下，把多个回答块合并成一段 transcript 送去评分。
function buildSpeakingTranscript(userAnswers: Record<string, string>) {
  return Object.values(userAnswers)
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 解析本次请求实际使用的 prompt。
 *
 * 优先级：
 * 1. 前端当前编辑的 promptContent
 * 2. promptId 对应的数据库记录
 * 3. 当前 category + purpose 下的默认 prompt
 * 4. 代码内置 fallback
 */
async function resolvePrompt(params: {
  category: string;
  purpose: string;
  promptId?: string;
  promptContent?: string;
}) {
  if (params.promptContent?.trim()) {
    return {
      promptId: params.promptId || null,
      content: params.promptContent.trim(),
    };
  }

  if (params.promptId) {
    const selectedPrompt = await prisma.userPrompt.findUnique({
      where: { id: params.promptId },
    });
    if (selectedPrompt) {
      return {
        promptId: selectedPrompt.id,
        content: selectedPrompt.content,
      };
    }
  }

  const defaultPrompt = await prisma.userPrompt.findFirst({
    where: {
      category: params.category,
      purpose: params.purpose,
      isDefault: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (defaultPrompt) {
    return {
      promptId: defaultPrompt.id,
      content: defaultPrompt.content,
    };
  }

  return {
    promptId: null,
    content:
      params.category === "Speaking"
        ? FALLBACK_PROMPTS.speakingTranscript
        : FALLBACK_PROMPTS.writing,
  };
}

// 写作维持 OpenAI-compatible 链路，因此 Kimi 2.5 / Moonshot 等仍可直接复用。
async function evaluateWriting(params: {
  promptSysMsg: string;
  taskContext: string;
}) {
  const openai = getAiClient();
  const completion = await openai.chat.completions.create({
    model: getSubjectiveEvalModel(),
    messages: [
      {
        role: "system",
        content:
          `${params.promptSysMsg}\n` +
          "Return strict JSON only. Schema: " +
          "{ totalScore: number, dimensions: { TR: number, CC: number, LR: number, GRA: number }, summary: string }",
      },
      { role: "user", content: params.taskContext },
    ],
    response_format: { type: "json_object" },
  });

  return parseJsonSafely(completion.choices[0].message?.content || "{}");
}

// 口语“转录评分”也改回 OpenAI-compatible 链路，便于直接使用 Kimi 2.5。
async function evaluateSpeakingTranscript(params: {
  promptSysMsg: string;
  promptBundle: string;
  transcript: string;
}) {
  const openai = getAiClient();
  const completion = await openai.chat.completions.create({
    model: getSpeakingTranscriptEvalModel(),
    messages: [
      {
        role: "system",
        content:
          `${params.promptSysMsg}\n` +
          "Return strict JSON only. Schema: " +
          "{ totalScore: number, dimensions: { FC: number, LR: number, GRA: number, P: number }, summary: string }. " +
          "FC means Fluency and Coherence. LR means Lexical Resource. GRA means Grammatical Range and Accuracy. P means Pronunciation. " +
          "The summary must be markdown and include strengths, weaknesses, and 3 specific next-step drills.",
      },
      {
        role: "user",
        content:
          `Speaking prompt bundle:\n${params.promptBundle}\n\n` +
          `Learner transcript:\n${params.transcript}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  return parseJsonSafely(completion.choices[0].message?.content || "{}");
}

export async function POST(req: NextRequest) {
  try {
    // 1. 解析前端提交。useAi=false 表示只保存草稿，不调用模型。
    const body = (await req.json()) as EvalBody;
    const {
      unitId,
      userAnswers,
      promptId,
      promptContent,
      timeSpent,
      useAi = true,
    } = body;

    if (!unitId || !userAnswers || typeof userAnswers !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // 2. 后端自己查题目，避免前端篡改题干或题型。
    const unit = await prisma.questionUnit.findUnique({
      where: { id: unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // 3. 根据题型决定当前 prompt 的用途。
    const purpose = unit.category === "Speaking" ? "transcript_eval" : "evaluation";
    const resolvedPrompt = await resolvePrompt({
      category: unit.category,
      purpose,
      promptId,
      promptContent,
    });

    const session = await getServerSession(authOptions);
    const userId =
      session?.user && "id" in session.user
        ? (session.user as { id: string }).id
        : null;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // 4. 只保存模式：把原始答案和本次实际使用的 prompt 一起存下来，方便 review。
    if (!useAi) {
      const submission = await prisma.submission.create({
        data: {
          unitId,
          userId,
          promptId: resolvedPrompt.promptId,
          answers: {
            userAnswers,
            timeSpent: timeSpent || 0,
            promptContent: resolvedPrompt.content,
            promptPurpose: purpose,
          },
        },
      });

      return NextResponse.json({
        data: {
          submissionId: submission.id,
          mode: "saved",
        },
      });
    }

    let aiParsed: {
      totalScore?: number;
      dimensions?: SubjectiveDimensions;
      summary?: string;
    };

    // 5. 题型分流：
    // - Speaking：把 transcript 发给 Kimi/OpenAI-compatible 模型评分
    // - Writing：走原有写作评分链路
    if (unit.category === "Speaking") {
      const promptBundle = unit.questions
        .map((question) => question.stem.replace(/<[^>]*>?/gm, " ").trim())
        .join("\n\n");
      const transcript = buildSpeakingTranscript(userAnswers);

      aiParsed = await evaluateSpeakingTranscript({
        promptSysMsg: resolvedPrompt.content,
        promptBundle,
        transcript,
      });
    } else {
      const taskContext = unit.questions
        .map((question) => {
          const response = userAnswers[question.id] || "No Answer Provided";
          return `[TASK PROMPT: ${question.stem.replace(/<[^>]*>?/gm, "")}]\n[USER RESPONSE: ${response}]`;
        })
        .join("\n\n");

      aiParsed = await evaluateWriting({
        promptSysMsg: resolvedPrompt.content,
        taskContext,
      });
    }

    // 6. 标准化返回结构，保证总分缺失时前端仍能稳定展示。
    const normalizedDimensions =
      aiParsed.dimensions && Object.keys(aiParsed.dimensions).length > 0
        ? aiParsed.dimensions
        : {};
    const fallbackTotalScore =
      typeof aiParsed.totalScore === "number"
        ? aiParsed.totalScore
        : getAverageBand(normalizedDimensions);

    // 7. 把答案、实际 prompt、评分维度、summary 一起持久化。
    const submission = await prisma.submission.create({
      data: {
        unitId,
        userId,
        promptId: resolvedPrompt.promptId,
        answers: {
          userAnswers,
          timeSpent: timeSpent || 0,
          promptContent: resolvedPrompt.content,
          promptPurpose: purpose,
        },
        aiScore: {
          ...normalizedDimensions,
          totalScore: fallbackTotalScore,
          model:
            unit.category === "Speaking"
              ? getSpeakingTranscriptEvalModel()
              : getSubjectiveEvalModel(),
        },
        aiFeedback: aiParsed.summary || "No feedback generated.",
      },
    });

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        mode: "ai",
        aiEvaluation: {
          totalScore: fallbackTotalScore,
          dimensions: normalizedDimensions,
          summary: aiParsed.summary || "No feedback generated.",
        },
      },
    });
  } catch (error) {
    // 503 用于“模型服务未配置/暂不可用”，其余错误按 500 返回。
    console.error("API Error: POST /api/eval/subjective -", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    const status =
      details.includes("未配置") || details.includes("configured") ? 503 : 500;
    return NextResponse.json(
      { error: "AI Subjective Evaluation failed", details },
      { status },
    );
  }
}
