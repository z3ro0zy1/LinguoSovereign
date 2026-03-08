import { prisma } from "../src/lib/prisma";

async function main() {
  const submissions = await prisma.submission.findMany({
    include: { unit: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  console.log("Categories in recent submissions:");
  const categories = submissions.map((s) => ({
    title: s.unit.title,
    category: s.unit.category,
    aiScore: s.aiScore,
  }));
  console.log(JSON.stringify(categories, null, 2));

  const distinctCategories = await prisma.questionUnit.findMany({
    distinct: ["category"],
    select: { category: true },
  });
  console.log("\nDistinct categories in QuestionUnit table:");
  console.log(JSON.stringify(distinctCategories, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
