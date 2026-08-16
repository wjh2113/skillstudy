import { NextResponse } from "next/server";
import { loadExternalSkill } from "@/lib/skill-sources";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skill = await loadExternalSkill({
      sourcePath: String(body.sourcePath || ""),
      name: body.name ? String(body.name) : undefined,
      overwrite: Boolean(body.overwrite),
    });
    return NextResponse.json({ skill }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
