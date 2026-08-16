import { NextResponse } from "next/server";
import { deleteSkill, getSkill } from "@/lib/skills";

type Ctx = { params: Promise<{ name: string }> };

function skillNameFromParams(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { name: raw } = await ctx.params;
    const skill = await getSkill(skillNameFromParams(raw));
    return NextResponse.json({ skill });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { name: raw } = await ctx.params;
    await deleteSkill(skillNameFromParams(raw));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
