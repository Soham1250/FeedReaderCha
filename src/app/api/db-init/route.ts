import { NextResponse } from "next/server";
import { dbInit } from "@/lib/dbInit";

export async function GET() {
  try {
    const result = await dbInit();
    if (result.success) {
      return NextResponse.json({
        message: "Database initialized successfully!",
        success: true,
      });
    } else {
      return NextResponse.json(
        {
          message: "Database initialization failed.",
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        message: "Unexpected error during database initialization.",
        success: false,
        error: error.message || error,
      },
      { status: 500 }
    );
  }
}
