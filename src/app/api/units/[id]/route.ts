import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Fetch the full unit document along with its associated questions.
    // We order questions by serialNumber to match the original Cambridge exam layout.
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
  } catch (error: any) {
    console.error(`API Error: GET /api/units/[id] -`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch question unit details",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
