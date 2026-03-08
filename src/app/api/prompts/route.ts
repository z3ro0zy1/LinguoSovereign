import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category"); // "Writing" or "Speaking"

    const whereClause = category ? { category } : {};

    const prompts = await prisma.userPrompt.findMany({
      where: whereClause,
      orderBy: [
        { isDefault: "desc" }, // default always first
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ data: prompts });
  } catch (error: any) {
    console.error("API Error: GET /api/prompts -", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, name, content, isDefault } = body;

    if (!category || !name || !content) {
      return NextResponse.json(
        { error: "Missing required payload (category, name, content)" },
        { status: 400 },
      );
    }

    // If this new prompt is marked as default, unset previous defaults for the same category
    // This ensures that Every category (Writing, Speaking) has exactly one active global default.
    if (isDefault) {
      await prisma.userPrompt.updateMany({
        where: { category },
        data: { isDefault: false },
      });
    }

    const newPrompt = await prisma.userPrompt.create({
      data: {
        category,
        name,
        content,
        isDefault: Boolean(isDefault),
      },
    });

    return NextResponse.json({ data: newPrompt });
  } catch (error: any) {
    console.error("API Error: POST /api/prompts -", error);
    return NextResponse.json(
      { error: "Failed to create prompt", details: error.message },
      { status: 500 },
    );
  }
}
