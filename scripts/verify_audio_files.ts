import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const units = await prisma.questionUnit.findMany({
    where: { audioUrl: { not: null } },
    select: { title: true, audioUrl: true },
  });

  const publicDir = "/Users/ronaldlee/Desktop/LinguoSovereign/public";
  const results = [];

  for (const u of units) {
    if (!u.audioUrl) continue;
    const fullPath = path.join(publicDir, u.audioUrl);
    if (!fs.existsSync(fullPath)) {
      results.push({
        title: u.title,
        audioUrl: u.audioUrl,
        error: "File not found",
      });
    }
  }

  if (results.length === 0) {
    console.log("All linked audio files exist.");
  } else {
    console.log("Found missing audio files:");
    console.log(JSON.stringify(results, null, 2));
  }

  // Also check if any listening parts have NULL audioUrl
  const missingLinks = await prisma.questionUnit.findMany({
    where: {
      category: "Reading/Listening",
      title: { contains: "Part" },
      audioUrl: null,
    },
    select: { title: true },
  });

  if (missingLinks.length > 0) {
    console.log("\nListening units missing audio links:");
    console.log(
      JSON.stringify(
        missingLinks.map((m) => m.title),
        null,
        2,
      ),
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
