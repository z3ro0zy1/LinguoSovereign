import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiClient, getSubjectiveEvalModel } from "@/lib/ai";

/**
 * POST /api/eval/subjective
 *
 * Subjective AI Evaluation Pipeline (Speaking & Writing)
 * 1. Receives transcribed voice text, or written essays mapped by question.
 * 2. Fetches the overarching Unit's prompt text (stem) from the database to afford the LLM full task context.
 * 3. Identifies the correct 'System Prompt' (the instructions detailing How to act: e.g., "Act as an IELTS Examiner...").
 *    - Defaults to a standard prompt if no custom prompt ID is provided.
 * 4. Merges the Task Prompt and User Response into a user message context.
 * 5. Queries OpenAI (GPT-4o) enforcing `response_format: { type: "json_object" }` to guarantee machine-readable feedback.
 * 6. Stores the structured AI JSON (with granular sub-scores like TR, CC, LR, GRA) back into PosgreSQL.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic body params
    const body = await req.json();
    const { unitId, userAnswers, promptId, timeSpent, useAi = true } = body;
    // userAnswers format for subjective is likely: { [questionId/partName]: "User transcribed text or typed essay" }

    if (!unitId || !userAnswers) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Load Unit and Questions explicitly to present to AI Model
    const unit = await prisma.questionUnit.findUnique({
      where: { id: unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Identify standard/selected evaluating prompt
    let promptSysMsg =
      "You are a professional IELTS examiner. Evaluate the candidate response with clear band-style judgement across TR, CC, LR, and GRA. Be strict, specific, and improvement-oriented. Output structured JSON only.";

    if (promptId) {
      const selectedPrompt = await prisma.userPrompt.findUnique({
        where: { id: promptId },
      });
      if (selectedPrompt) {
        promptSysMsg = selectedPrompt.content;
      }
    } else {
      const defaultPrompt = await prisma.userPrompt.findFirst({
        where: { category: unit.category, isDefault: true }, // Usually "Writing" or "Speaking"
      });
      if (defaultPrompt) {
        promptSysMsg = defaultPrompt.content;
      }
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : null;

    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!useAi) {
      const submission = await prisma.submission.create({
        data: {
          unitId,
          userId,
          promptId: promptId || null,
          answers: { userAnswers, timeSpent: timeSpent || 0 },
        },
      });

      return NextResponse.json({
        data: {
          submissionId: submission.id,
          mode: "saved",
        },
      });
    }

    // Construct the context: System receives the question DOM string and the user response text
    const taskContext = unit.questions
      .map((q) => {
        // In Writing: Q.stem contains the raw writing prompt html description
        const response = userAnswers[q.id] || "No Answer Provided";
        return `[TASK PROMPT: ${q.stem.replace(/<[^>]*>?/gm, "")}]\n[USER RESPONSE: ${response}]`;
      })
      .join("\n\n");

    const openai = getAiClient();
    const completion = await openai.chat.completions.create({
      model: getSubjectiveEvalModel(),
      messages: [
        {
          role: "system",
          content:
            promptSysMsg +
            "\nIMPORTANT: Must return a strict JSON payload describing the evaluation. Schema: { totalScore: number, dimensions: { TR: number, CC: number, LR: number, GRA: number }, summary: 'markdown string detailed feedback' }",
        },
        { role: "user", content: taskContext },
      ],
      // Enforce JSON mode to ensure aiParsed logic succeeds
      response_format: { type: "json_object" },
    });

    const aiApiResponse = completion.choices[0].message?.content || "{}";
    let aiParsed;
    try {
      aiParsed = JSON.parse(aiApiResponse);
    } catch {
      aiParsed = {
        error: "Failed to parse AI outcome JSON",
        raw: aiApiResponse,
      };
    }

    // Persist the evaluation
    const submission = await prisma.submission.create({
      data: {
        unitId,
        userId,
        promptId: promptId || null,
        answers: { userAnswers, timeSpent: timeSpent || 0 },
        aiScore: aiParsed.dimensions || { TR: 0, CC: 0, LR: 0, GRA: 0 },
        aiFeedback:
          aiParsed.summary || aiParsed.raw || "No feedback generated.",
      },
    });

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        mode: "ai",
        aiEvaluation: aiParsed,
      },
    });
  } catch (error) {
    console.error("API Error: POST /api/eval/subjective -", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    const status = details.includes("AI service is not configured") ? 503 : 500;
    return NextResponse.json(
      { error: "AI Subjective Evaluation failed", details },
      { status },
    );
  }
}
