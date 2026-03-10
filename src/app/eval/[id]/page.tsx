import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import EvalWrapper from "@/components/eval/EvalWrapper";

type EvalUnitSummary = {
  id: string;
  title: string;
};

export default async function EvalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flow?: string; mode?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const flowSequence = resolvedSearch.flow !== undefined ? resolvedSearch.flow : undefined;
  const subjectiveMode = resolvedSearch.mode === "ai" ? "ai" : "standard";

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

  const requiresAuth = unit.category === "Writing" || unit.category === "Speaking";
  if (requiresAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      const callbackUrl = `/eval/${resolvedParams.id}${resolvedSearch.mode === "ai" ? "?mode=ai" : ""}`;
      redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }

  let testPrefix = "";
  const match = unit.title.match(/(剑\d+\s*Test\s*\d+|C\d+-T\d+)/i);
  if (match) {
    testPrefix = match[1];
  }

  let siblings: EvalUnitSummary[] = [];
  if (testPrefix) {
    let subTypeFilter = "";
    if (unit.category === "Reading/Listening") {
      if (unit.title.includes("Passage")) subTypeFilter = "Passage";
      else if (unit.title.includes("Part")) subTypeFilter = "Part";
    } else if (unit.category === "Writing") {
      subTypeFilter = "Task";
    }

    const queryConditions: Array<{ title: { contains: string } }> = [
      { title: { contains: testPrefix } },
    ];
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

  const unitData = JSON.parse(JSON.stringify(unit)) as typeof unit;
  const siblingsData = JSON.parse(JSON.stringify(siblings)) as EvalUnitSummary[];
  const shouldSubmitIndividually = !flowSequence && (unit.category === "Writing" || unit.category === "Speaking");
  const allFlowIds = shouldSubmitIndividually
    ? [unitData.id]
    : flowSequence
      ? flowSequence.split(",")
      : siblingsData.map((sibling) => sibling.id);

  if (allFlowIds.length === 0) allFlowIds.push(unitData.id);

  return (
    <div className="container mx-auto mb-24 w-full max-w-[1600px] p-4">
      <EvalWrapper
        unit={unitData}
        siblings={siblingsData}
        flowSequence={flowSequence}
        allFlowIds={allFlowIds}
        subjectiveMode={subjectiveMode}
      />
    </div>
  );
}
