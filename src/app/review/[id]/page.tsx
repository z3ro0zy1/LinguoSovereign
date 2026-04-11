import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReviewClient from "./ReviewClient";
import { roundIELTS } from "@/lib/utils";

/**
 * ReviewPage - The main entry point for the review interface.
 * It handles the asynchronous fetching of search parameters and passes them to the server-side logic.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const submissionId = resolvedSearch?.submissionId;

  // Pass control to ReviewServerWrapper to perform authenticated data fetching
  return (
    <ReviewServerWrapper
      id={resolvedParams.id}
      submissionId={typeof submissionId === "string" ? submissionId : undefined}
    />
  );
}

/**
 * ReviewServerWrapper - A restricted server component that handles:
 * 1. User authentication.
 * 2. Database lookups for the specific QuestionUnit and its Submission.
 * 3. Calculation of IELTS scores based on stored results.
 */
async function ReviewServerWrapper({
  id,
  submissionId,
}: {
  id: string;
  submissionId?: string;
}) {
  const session = await getServerSession(authOptions);

  // Check for active session, otherwise redirect to sign-in
  if (!session || !session.user || !("id" in session.user)) {
    redirect("/login");
  }

  // Fetch the specific unit (test section) including all its individual questions
  const unit = await prisma.questionUnit.findUnique({
    where: { id },
    include: { questions: { orderBy: { serialNumber: "asc" } } },
  });

  if (!unit) {
    return <div className="p-10">Module not found.</div>;
  }

  /**
   * Submission Retrieval Logic:
   * - If a specific submissionId is provided (e.g. from attempt history), load that exact attempt.
   * - Otherwise, render the pure reference/detail view with no user submission attached.
   */
  let submission = null;
  if (submissionId && typeof submissionId === "string") {
    submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
  }

  // Determine if the content is objective (auto-gradable) based on category
  const isObjective =
    unit.category === "Reading" ||
    unit.category === "Listening" ||
    unit.category === "Reading/Listening";

  const aiScore = submission?.aiScore;
  const feedbackData = aiScore as
    | Record<string, string | number | undefined>
    | null
    | undefined;
  let calculatedScore = 0;

  if (feedbackData) {
    if (isObjective) {
      /**
       * For Reading/Listening:
       * scoreRatio is a decimal (e.g., 0.825).
       * We multiply by 9 (IELTS Max) and round to the nearest 0.5 band score.
       */
      const ratio = Number.parseFloat(String(feedbackData.scoreRatio ?? "0"));
      calculatedScore = roundIELTS(ratio * 9);
    } else {
      const subjectDimensions =
        unit.category === "Speaking"
          ? ["FC", "LR", "GRA", "P"]
          : ["TR", "CC", "LR", "GRA"];
      const subjectScores = subjectDimensions
        .map((key) => Number(feedbackData[key]))
        .filter((value) => !Number.isNaN(value));

      if (subjectScores.length) {
        const rawAverage =
          subjectScores.reduce((sum, value) => sum + value, 0) /
          subjectScores.length;
        calculatedScore = roundIELTS(rawAverage);
      } else if (!Number.isNaN(Number(feedbackData.totalScore))) {
        calculatedScore = roundIELTS(Number(feedbackData.totalScore));
      }
    }
  }

  // Render the interactive Client side of the review page
  return (
    <ReviewClient
      unit={unit}
      submission={submission}
      isObjective={isObjective}
      calculatedScore={calculatedScore}
    />
  );
}
