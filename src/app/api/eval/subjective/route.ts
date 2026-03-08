import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Assuming we inject OPENAI_API_KEY in our general .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

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
    const { unitId, userAnswers, promptId } = body;
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
      "You are an expert IELTS examiner. Evaluate the following writing or speaking task carefully evaluating TR/CC/LR/GRA. Output structured JSON. ";

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

    // Construct the context: System receives the question DOM string and the user response text
    const taskContext = unit.questions
      .map((q) => {
        // In Writing: Q.stem contains the raw writing prompt html description
        const response = userAnswers[q.id] || "No Answer Provided";
        return `[TASK PROMPT: ${q.stem.replace(/<[^>]*>?/gm, "")}]\n[USER RESPONSE: ${response}]`;
      })
      .join("\n\n");

    // Make GPT-4o call requiring JSON output
    // model: "gpt-4o" is used for high-fidelity evaluation and reliable JSON formatting.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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

    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : null;

    // Persist the evaluation
    const submission = await prisma.submission.create({
      data: {
        unitId,
        userId,
        promptId: promptId || null,
        answers: userAnswers,
        aiScore: aiParsed.dimensions || { TR: 0, CC: 0, LR: 0, GRA: 0 },
        aiFeedback:
          aiParsed.summary || aiParsed.raw || "No feedback generated.",
      },
    });

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        aiEvaluation: aiParsed,
      },
    });
  } catch (error: any) {
    console.error("API Error: POST /api/eval/subjective -", error);
    return NextResponse.json(
      { error: "AI Subjective Evaluation failed", details: error.message },
      { status: 500 },
    );
  }
}
