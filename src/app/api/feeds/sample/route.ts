import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "sample-feeds.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to read sample feeds:", error);
    return NextResponse.json(
      { error: "Failed to read sample feeds data." },
      { status: 500 }
    );
  }
}
