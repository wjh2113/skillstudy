import { NextResponse } from "next/server";
import { downloadSkill } from "@/lib/skills";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skill = await downloadSkill({
      url: String(body.url || ""),
      name: body.name ? String(body.name) : undefined,
    });
    return NextResponse.json({ skill }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
