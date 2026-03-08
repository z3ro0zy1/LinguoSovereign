import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !("id" in session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const data = await req.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // --- Local Storage Strategy ---
    // Files are stored in public/uploads for direct browser access.
    // In production, this would typically be replaced by an S3 or Vercel Blob proxy.
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() || "png";
    // Unique filename using userId and timestamp to prevent collisions
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    // Map the system path to a public web URL
    const fileUrl = `/uploads/${fileName}`;

    return NextResponse.json({ url: fileUrl }, { status: 200 });
  } catch (error: any) {
    console.error("API Error: POST /api/upload -", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
