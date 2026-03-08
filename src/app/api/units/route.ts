import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const skip = (page - 1) * limit;

    const whereClause = category ? { category } : {};

    // --- DATA FETCHING ---
    // Fetch a paginated list of units. We explicitly select only necessary fields
    // to avoid sending heavy 'passage' or 'questions' JSON blobs over the wire in a list view.
    const [units, total] = await Promise.all([
      prisma.questionUnit.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          category: true,
          createdAt: true,
        },
        orderBy: { title: "asc" },
        skip,
        take: limit,
      }),
      prisma.questionUnit.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: units,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("API Error: GET /api/units -", error);
    return NextResponse.json(
      { error: "Failed to fetch question units", details: error.message },
      { status: 500 },
    );
  }
}
