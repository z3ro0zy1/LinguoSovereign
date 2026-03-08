import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const allUnits = await prisma.questionUnit.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      createdAt: true,
    },
    orderBy: {
      title: "asc",
    },
  });

  return <DashboardClient allUnits={allUnits} />;
}
