import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PromptBody = {
  category?: string;
  name?: string;
  content?: string;
  isDefault?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const whereClause = category ? { category } : {};

    const prompts = await prisma.userPrompt.findMany({
      where: whereClause,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: prompts });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("API Error: GET /api/prompts -", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts", details },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PromptBody;
    const { category, name, content, isDefault } = body;

    if (!category || !name || !content) {
      return NextResponse.json(
        { error: "Missing required payload (category, name, content)" },
        { status: 400 },
      );
    }

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
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("API Error: POST /api/prompts -", error);
    return NextResponse.json(
      { error: "Failed to create prompt", details },
      { status: 500 },
    );
  }
}
