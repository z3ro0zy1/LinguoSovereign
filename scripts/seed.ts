import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

function getCategory(dirName: string): string {
  if (dirName.includes("Listen_Read")) return "Reading/Listening";
  if (dirName.includes("Write")) return "Writing";
  if (dirName.includes("Speak")) return "Speaking";
  return "Unknown";
}

async function main() {
  const baseDir = "/Users/ronaldlee/Desktop/IELTS_Json";
  const subdirs = ["IELTS_Listen_Read", "IELTS_Write", "IELTS_Speak"];
  let totalProcessed = 0;

  for (const subdir of subdirs) {
    const fullDirPath = path.join(baseDir, subdir);
    if (!fs.existsSync(fullDirPath)) continue;

    const files = fs
      .readdirSync(fullDirPath)
      .filter((file) => file.endsWith(".json"));
    const categoryName = getCategory(subdir);

    for (const file of files) {
      const filePath = path.join(fullDirPath, file);
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const jsonData = JSON.parse(fileContent);

        const sourceId = String(jsonData.id);

        const unit = await prisma.questionUnit.create({
          data: {
            sourceId: sourceId,
            title: jsonData.title || file.replace(".json", ""),
            audioUrl: jsonData.audioUrl || null,
            category: categoryName,
            passage: jsonData.passage || [],
            questions: {
              create: (jsonData.questions || []).map((q: any) => ({
                serialNumber: q.serialNumber || 0,
                type: q.type || "Unknown",
                stem: q.stem || "",
                options: q.options && q.options.length > 0 ? q.options : null,
                answer: q.answer && Array.isArray(q.answer) ? q.answer : null,
                officialAnalysis:
                  q.officialAnalysis && Array.isArray(q.officialAnalysis)
                    ? q.officialAnalysis
                    : null,
              })),
            },
          },
        });

        totalProcessed++;
        console.log(
          `✅ Loaded: ${unit.title} (${categoryName}) - ${jsonData.questions?.length} q's`,
        );
      } catch (e: any) {
        console.error(`❌ Error parsing or inserting ${file}: ${e.message}`);
      }
    }
  }

  console.log(
    `🎉 Seeding finished! Inserted ${totalProcessed} question units.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
