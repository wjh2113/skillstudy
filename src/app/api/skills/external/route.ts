import { NextResponse } from "next/server";
import { listExternalSkills } from "@/lib/skill-sources";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listExternalSkills();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
