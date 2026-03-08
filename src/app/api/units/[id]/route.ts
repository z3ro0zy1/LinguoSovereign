import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const unit = await prisma.questionUnit.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { serialNumber: "asc" },
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Question Unit not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: unit });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error(`API Error: GET /api/units/[id] -`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch question unit details",
        details,
      },
      { status: 500 },
    );
  }
}
