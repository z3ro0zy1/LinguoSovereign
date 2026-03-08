import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
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
  searchParams: Promise<{ flow?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const flowSequence = resolvedSearch.flow !== undefined ? resolvedSearch.flow : undefined;

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
  const allFlowIds = flowSequence
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
      />
    </div>
  );
}
