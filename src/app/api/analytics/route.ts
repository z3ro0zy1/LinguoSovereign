import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundIELTS } from "@/lib/utils";

/**
 * GET /api/analytics
 *
 * Aggregates user performance data for the dashboard:
 * 1. Fetches all submissions for the current authenticated user.
 * 2. Normalizes categories (splitting 'Reading/Listening' units based on title).
 * 3. Calculates average band scores for all 4 IELTS categories, rounding to the nearest 0.5.
 * 4. Generates timeline data for progress charts, averaging scores by date.
 * 5. Compiles a high-level statistics summary (total tests, total time).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const submissions = (await prisma.submission.findMany({
      where: { userId },
      include: {
        unit: true, // Pull in unit to figure out categories
      },
      orderBy: { createdAt: "asc" }, // chronological for charts
    })) as any[];

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        totalTests: 0,
        averageScores: { Reading: 0, Listening: 0, Writing: 0, Speaking: 0 },
        totalTimeSpent: 0,
        timeline: [],
      });
    }

    const categoryStats: Record<string, { sum: number; count: number }> = {
      Reading: { sum: 0, count: 0 },
      Listening: { sum: 0, count: 0 },
      Writing: { sum: 0, count: 0 },
      Speaking: { sum: 0, count: 0 },
    };

    const timelineMap: Record<string, any> = {};
    let totalTime = 0;

    submissions.forEach((sub) => {
      let finalCategory = sub.unit.category;
      if (finalCategory === "Reading/Listening") {
        finalCategory = sub.unit.title.includes("Passage")
          ? "Reading"
          : "Listening";
      }

      let score = 0;
      const rawScoreAny = sub.aiScore as any;
      if (rawScoreAny) {
        if (finalCategory === "Reading" || finalCategory === "Listening") {
          // Objective: scale ratio (0.0-1.0) to IELTS band (0-9)
          const ratio = parseFloat(rawScoreAny.scoreRatio || "0");
          score = roundIELTS(ratio * 9);
          totalTime += rawScoreAny.timeSpent || 0;
        } else {
          // Subjective: average of TR, CC, LR, GRA
          if (rawScoreAny.TR !== undefined) {
            const rawAverage =
              (Number(rawScoreAny.TR) +
                Number(rawScoreAny.CC) +
                Number(rawScoreAny.LR) +
                Number(rawScoreAny.GRA)) /
              4;
            score = roundIELTS(rawAverage);
          }
        }
      }

      // Update aggregate stats
      if (categoryStats[finalCategory]) {
        categoryStats[finalCategory].sum += score;
        categoryStats[finalCategory].count += 1;
      }

      const date = sub.createdAt.toISOString().split("T")[0];
      if (!timelineMap[date]) {
        timelineMap[date] = {
          date,
          Reading: [],
          Listening: [],
          Writing: [],
          Speaking: [],
        };
      }

      const chartCat = finalCategory as keyof (typeof timelineMap)[string];
      if (
        timelineMap[date][chartCat] &&
        Array.isArray(timelineMap[date][chartCat])
      ) {
        timelineMap[date][chartCat].push(score);
      }
    });

    /**
     * Finalize timeline chart data:
     * If multiple tests occurred on the same day, we average them and round to 0.5 step.
     */
    const timeline = Object.values(timelineMap).map((day: any) => {
      const res: any = { date: day.date };
      ["Reading", "Listening", "Writing", "Speaking"].forEach((cat) => {
        if (day[cat] && day[cat].length > 0) {
          const avg =
            day[cat].reduce((a: number, b: number) => a + b, 0) /
            day[cat].length;
          res[cat] = roundIELTS(avg);
        }
      });
      return res;
    });

    // Calculate global averages (rounded to IELTS standard)
    const averageScores = {
      Reading:
        categoryStats.Reading.count > 0
          ? roundIELTS(categoryStats.Reading.sum / categoryStats.Reading.count)
          : 0,
      Listening:
        categoryStats.Listening.count > 0
          ? roundIELTS(
              categoryStats.Listening.sum / categoryStats.Listening.count,
            )
          : 0,
      Writing:
        categoryStats.Writing.count > 0
          ? roundIELTS(categoryStats.Writing.sum / categoryStats.Writing.count)
          : 0,
      Speaking:
        categoryStats.Speaking.count > 0
          ? roundIELTS(
              categoryStats.Speaking.sum / categoryStats.Speaking.count,
            )
          : 0,
    };

    /**
     * Prepare historical records for the table.
     * Each entry is normalized and rounded individually.
     */
    const history = submissions.map((sub) => {
      let category = sub.unit.category;
      if (category === "Reading/Listening") {
        category = sub.unit.title.includes("Passage") ? "Reading" : "Listening";
      }

      let score = 0;
      const rawScoreAny = sub.aiScore as any;
      if (rawScoreAny) {
        if (category === "Reading" || category === "Listening") {
          const ratio = parseFloat(rawScoreAny.scoreRatio || "0");
          score = roundIELTS(ratio * 9);
        } else {
          if (rawScoreAny.TR !== undefined) {
            const rawAverage =
              (Number(rawScoreAny.TR) +
                Number(rawScoreAny.CC) +
                Number(rawScoreAny.LR) +
                Number(rawScoreAny.GRA)) /
              4;
            score = roundIELTS(rawAverage);
          }
        }
      }
      return {
        id: sub.id,
        unitId: sub.unitId,
        date: sub.createdAt.toISOString(),
        category,
        unitTitle: sub.unit.title,
        score,
        timeSpent: rawScoreAny?.timeSpent || 0,
      };
    });

    return NextResponse.json({
      totalTests: submissions.length,
      averageScores,
      totalTimeSpent: totalTime, // in seconds
      timeline,
      history: history.reverse(),
    });
  } catch (error: any) {
    console.error("API Error: GET /api/analytics -", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
