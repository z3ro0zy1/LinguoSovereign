import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type SeedQuestion = {
  serialNumber?: number;
  type?: string;
  stem?: string;
  options?: Prisma.InputJsonValue | null;
  answer?: Prisma.InputJsonValue | null;
  officialAnalysis?: Prisma.InputJsonValue | null;
};

type SeedUnit = {
  id: string | number;
  title?: string;
  audioUrl?: string | null;
  passage?: Prisma.InputJsonValue | null;
  questions?: SeedQuestion[];
};

function getCategory(dirName: string): string {
  if (dirName.includes("Listen_Read")) return "Reading/Listening";
  if (dirName.includes("Write")) return "Writing";
  if (dirName.includes("Speak")) return "Speaking";
  return "Unknown";
}

function toNullableJson(value: Prisma.InputJsonValue | null | undefined) {
  return value ?? Prisma.JsonNull;
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
        const jsonData = JSON.parse(fileContent) as SeedUnit;

        const unit = await prisma.questionUnit.create({
          data: {
            sourceId: String(jsonData.id),
            title: jsonData.title || file.replace(".json", ""),
            audioUrl: jsonData.audioUrl || null,
            category: categoryName,
            passage: jsonData.passage || [],
            questions: {
              create: (jsonData.questions || []).map((question) => ({
                serialNumber: question.serialNumber || 0,
                type: question.type || "Unknown",
                stem: question.stem || "",
                options: toNullableJson(question.options),
                answer: toNullableJson(question.answer),
                officialAnalysis: toNullableJson(question.officialAnalysis),
              })),
            },
          },
        });

        totalProcessed += 1;
        console.log(
          `✅ Loaded: ${unit.title} (${categoryName}) - ${jsonData.questions?.length || 0} q's`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Error parsing or inserting ${file}: ${message}`);
      }
    }
  }

  console.log(`🎉 Seeding finished! Inserted ${totalProcessed} question units.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
