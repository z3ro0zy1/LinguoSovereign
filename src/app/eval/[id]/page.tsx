import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EvalWrapper from "@/components/eval/EvalWrapper";

/**
 * EvalPage - Server Component
 * The entry point for taking a test.
 * It handles the loading of a single QuestionUnit and its siblings (Passage 1, 2, 3 OR Task 1, 2).
 */
export default async function EvalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flow?: string }>; // Optional comma-separated IDs for batch testing
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  // flowSequence is used for "Full Test" modes where multiple parts are queued
  const flowSequence =
    resolvedSearch.flow !== undefined ? resolvedSearch.flow : undefined;

  // Load the current specific question unit
  const unit = await prisma.questionUnit.findUnique({
    where: { id: resolvedParams.id },
    include: {
      questions: {
        orderBy: { serialNumber: "asc" },
      },
    },
  });

  if (!unit) {
    return notFound();
  }

  /**
   * --- SIBLING DETECTION ---
   * Automatically find other parts of the same Cambridge test (e.g. C17-T1).
   * This allows the user to switch between passages/tasks easily.
   */
  let testPrefix = "";
  const match = unit.title.match(/(剑\d+\s*Test\s*\d+|C\d+-T\d+)/i);
  if (match) {
    testPrefix = match[1];
  }

  let siblings: any[] = [];
  if (testPrefix) {
    let subTypeFilter = "";
    if (unit.category === "Reading/Listening") {
      if (unit.title.includes("Passage")) subTypeFilter = "Passage";
      else if (unit.title.includes("Part")) subTypeFilter = "Part";
    } else if (unit.category === "Writing") {
      subTypeFilter = "Task";
    }

    const queryConditions: any[] = [{ title: { contains: testPrefix } }];
    if (subTypeFilter) {
      queryConditions.push({ title: { contains: subTypeFilter } });
    }

    siblings = await prisma.questionUnit.findMany({
      where: {
        AND: queryConditions,
        category: unit.category,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        title: "asc",
      },
    });
  }

  // Serialize Prisma objects to plain POJOs for Client Component compatibility
  const unitData = JSON.parse(JSON.stringify(unit));
  const siblingsData = JSON.parse(JSON.stringify(siblings));

  /**
   * Determine the total IDs in the current session.
   * If 'flow' query param is present, it defines the test set.
   * Otherwise, we default to the detected siblings (e.g. all 3 passages of C17-T1).
   */
  const allFlowIds = flowSequence
    ? flowSequence.split(",")
    : siblingsData.map((s: any) => s.id);

  // Ensure the current ID is always at least one of the IDs
  if (allFlowIds.length === 0) allFlowIds.push(unitData.id);

  return (
    <div className="container mx-auto p-4 w-full max-w-[1600px] mb-24">
      {/* 
          EvalWrapper is the main orchestrator for the test UI.
          It handles timer, audio, input capture, and submission.
      */}
      <EvalWrapper
        unit={unitData}
        siblings={siblingsData}
        flowSequence={flowSequence}
        allFlowIds={allFlowIds}
      />
    </div>
  );
}
