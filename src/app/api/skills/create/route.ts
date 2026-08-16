import { NextResponse } from "next/server";
import { createSkill } from "@/lib/skills";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skill = await createSkill({
      name: String(body.name || ""),
      description: String(body.description || ""),
      body: body.body ? String(body.body) : undefined,
      disableModelInvocation: body.disableModelInvocation !== false,
      withScripts: Boolean(body.withScripts),
    });
    return NextResponse.json({ skill }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
