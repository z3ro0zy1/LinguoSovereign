import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiClient, getReadingAnalysisModel } from "@/lib/ai";
import { Prisma } from "@prisma/client";

type AnalysisQuestion = {
  questionId: string;
  analysis: string;
};

type StoredOfficialAnalysis =
  | string
  | string[]
  | {
      reference?: unknown;
      aiGrammarAnalysis?: string;
    };

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => [key, toJsonValue(item)],
    );
    return Object.fromEntries(entries) as Prisma.InputJsonObject;
  }

  return String(value);
}

function normalizePassageText(passage: unknown) {
  if (!Array.isArray(passage)) return "";

  return passage
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }

      if (block && typeof block === "object") {
        const candidate = block as {
          english?: string;
          title?: string;
        };
        return candidate.english || candidate.title || "";
      }

      return "";
    })
    .join("\n\n")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 详解页里的阅读 AI 解析是“开发期预生成能力”，不是用户实时调用型功能。
 * 约束：
 * 1. 仅允许 development 环境调用，避免线上随手触发写库。
 * 2. 直接把整篇文章 + 整组题目一起发给模型，让模型自己决定哪些句子最值得讲。
 * 3. 最终只把“题级分析”落到 Question.officialAnalysis，复用现有详解展示位。
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Reading AI analysis generation is development-only." },
        { status: 403 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user || !("id" in session.user)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as { unitId?: string };
    if (!body.unitId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const unit = await prisma.questionUnit.findUnique({
      where: { id: body.unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const isReadingUnit =
      unit.category === "Reading/Listening" && unit.title.includes("Passage");

    if (!isReadingUnit) {
      return NextResponse.json(
        { error: "Only reading units support AI passage analysis." },
        { status: 400 },
      );
    }

    const passageText = normalizePassageText(unit.passage);
    const questionBundle = unit.questions
      .map(
        (question) =>
          `Q${question.serialNumber} (${question.id}): ${stripHtml(question.stem)}`,
      )
      .join("\n");

    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: getReadingAnalysisModel(),
      messages: [
        {
          role: "system",
          content:
            "You are an expert IELTS reading tutor. Analyze the full passage and generate concise but high-value explanations for each question. " +
            "For every question, identify the most relevant sentence or clause from the passage, explain the grammar or paraphrase trap, and give a short Chinese explanation. " +
            "Return strict JSON only with schema: { questions: [{ questionId: string, analysis: string }] }. " +
            "Each analysis should be plain text or markdown-friendly text under 220 words.",
        },
        {
          role: "user",
          content:
            `Reading title: ${unit.title}\n\n` +
            `Passage:\n${passageText}\n\n` +
            `Questions:\n${questionBundle}\n\n` +
            "Generate one analysis for every listed questionId.",
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message?.content || "{}";
    const parsed = JSON.parse(raw) as {
      questions?: AnalysisQuestion[];
    };

    const analyses = (parsed.questions || []).filter(
      (item) => item.questionId && item.analysis,
    );

    if (!analyses.length) {
      return NextResponse.json(
        { error: "The model returned no usable reading analyses." },
        { status: 502 },
      );
    }

    await prisma.$transaction(
      analyses.map((item) => {
        const currentQuestion = unit.questions.find(
          (question) => question.id === item.questionId,
        );
        const currentAnalysis = currentQuestion?.officialAnalysis as
          | StoredOfficialAnalysis
          | undefined;

        const nextAnalysis =
          currentAnalysis &&
          typeof currentAnalysis === "object" &&
          !Array.isArray(currentAnalysis)
            ? {
                ...currentAnalysis,
                aiGrammarAnalysis: item.analysis,
              }
            : {
                reference: currentAnalysis ?? null,
                aiGrammarAnalysis: item.analysis,
              };

        return prisma.question.update({
          where: { id: item.questionId },
          data: { officialAnalysis: toJsonValue(nextAnalysis) },
        });
      }),
    );

    const refreshedUnit = await prisma.questionUnit.findUnique({
      where: { id: body.unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    return NextResponse.json({
      data: {
        model: getReadingAnalysisModel(),
        analysesSaved: analyses.length,
        questions: refreshedUnit?.questions || unit.questions,
      },
    });
  } catch (error) {
    console.error("API Error: POST /api/reading/analysis -", error);
    return NextResponse.json(
      {
        error: "Reading AI analysis generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
