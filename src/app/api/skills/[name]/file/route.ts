import { NextResponse } from "next/server";
import { readSkillFile } from "@/lib/skills";

type Ctx = { params: Promise<{ name: string }> };

function skillNameFromParams(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { name: raw } = await ctx.params;
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    const file = await readSkillFile(skillNameFromParams(raw), filePath);
    return NextResponse.json({ file });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
