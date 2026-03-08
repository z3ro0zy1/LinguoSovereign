import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 接口定义用户的答案对象 [questionId]: string[]
type ObjectiveAnswers = Record<string, string[]>;

/**
 * POST /api/eval/objective
 *
 * Objective Evaluation Pipeline (Reading & Listening)
 * 1. Receives the submission payload including raw selected options/typed texts.
 * 2. Fetches the absolute source of truth (the Question Unit schema) from the DB.
 * 3. Normalizes arrays (useful for Single vs. Multi-select differences).
 * 4. Runs algorithmic comparison between `userAnswers` and `q.answer`.
 *    - Uses string splitting logic since official data stores alternative valid answers separated by semicolons `;`.
 * 5. Returns granular success/fail booleans for each sub-question, ensuring the frontend can highlight correct/wrong UI states.
 * 6. Logs the submission result into the PostgreSQL DB for history and analytics.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, userAnswers, timeSpent } = body as {
      unitId: string;
      userAnswers: ObjectiveAnswers;
      timeSpent?: number;
    };

    if (!unitId || !userAnswers) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const unit = await prisma.questionUnit.findUnique({
      where: { id: unitId },
      include: { questions: { orderBy: { serialNumber: "asc" } } },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Question Unit not found" },
        { status: 404 },
      );
    }

    let totalCorrect = 0;
    let totalObjective = 0;

    const evaluateResults = unit.questions.map((q) => {
      if (!q.answer) {
        return {
          questionId: q.id,
          serialNumber: q.serialNumber,
          isCorrect: false,
          isSubjective: true,
          userAnswer: userAnswers[q.id] || null,
          officialAnswer: null,
          analysis: null,
        };
      }

      const officialAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
      const submittedAnsArray = Array.isArray(userAnswers[q.id])
        ? userAnswers[q.id]
        : [userAnswers[q.id] || ""];

      const subResults = officialAnswers.map((officialOptionStr, idx) => {
        const userProvided = String(submittedAnsArray[idx] || "")
          .trim()
          .toLowerCase();
        // official strings often use ';' to separate alternative valid answers
        const validOptions = String(officialOptionStr)
          .split(";")
          .map((o) => o.trim().toLowerCase())
          .filter((o) => o);
        const correct =
          validOptions.length > 0
            ? validOptions.includes(userProvided)
            : userProvided === String(officialOptionStr).trim().toLowerCase();

        if (correct) totalCorrect++;
        totalObjective++;

        return {
          isCorrect: correct,
          userAnswer: submittedAnsArray[idx] || "",
          officialAnswer: officialOptionStr,
        };
      });

      const isAllCorrect = subResults.every((r) => r.isCorrect);

      return {
        questionId: q.id,
        serialNumber: q.serialNumber,
        isCorrect: isAllCorrect,
        isSubjective: false,
        subResults, // Per-blank results
        officialAnalysis: q.officialAnalysis,
      };
    });

    const session = await getServerSession(authOptions);
    const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : null;

    // --- Persistence ---
    // Record the attempt in the database, including raw answers and the calculated score metadata.
    // aiScore stores a JSON blob that the analytics page uses to avoid re-calculating scores.
    const submission = await prisma.submission.create({
      data: {
        unitId,
        userId,
        answers: { userAnswers, timeSpent: timeSpent || 0 },
        aiScore: {
          totalCorrect,
          totalObjective,
          scoreRatio:
            totalObjective > 0 ? (totalCorrect / totalObjective).toFixed(2) : 0,
          timeSpent: timeSpent || 0,
        },
      },
    });

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        summary: { totalCorrect, totalObjective, timeSpent: timeSpent || 0 },
        results: evaluateResults,
      },
    });
  } catch (error) {
    console.error("API Error: POST /api/eval/objective -", error);
    return NextResponse.json(
      { error: "Evaluation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
