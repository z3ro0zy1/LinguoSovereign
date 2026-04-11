import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Prompt 现在不仅按题型区分，还按“用途/场景”区分。
 *
 * 例如：
 * - category=Writing, purpose=evaluation
 * - category=Speaking, purpose=transcript_eval
 * - category=Speaking, purpose=free_chat
 *
 * 这样仍然复用一张 UserPrompt 表，不需要额外建新表。
 */
type PromptBody = {
  category?: string;
  purpose?: string;
  name?: string;
  content?: string;
  isDefault?: boolean;
};

export async function GET(req: NextRequest) {
  try {
    // 前端会按 category + purpose 拉当前模式下可用的 prompt 列表。
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const purpose = searchParams.get("purpose");
    const whereClause = {
      ...(category ? { category } : {}),
      ...(purpose ? { purpose } : {}),
    };

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
    const { category, purpose = "evaluation", name, content, isDefault } = body;

    if (!category || !name || !content) {
      return NextResponse.json(
        { error: "Missing required payload (category, name, content)" },
        { status: 400 },
      );
    }

    if (isDefault) {
      // 同一类 prompt 在同一用途下只能有一条默认记录。
      await prisma.userPrompt.updateMany({
        where: { category, purpose },
        data: { isDefault: false },
      });
    }

    const newPrompt = await prisma.userPrompt.create({
      data: {
        category,
        purpose,
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
