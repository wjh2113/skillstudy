import { NextResponse } from "next/server";
import { getRun, listRuns, runAgent } from "@/lib/agent";
import { hasApiKey } from "@/lib/llm-config";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const run = await getRun(id);
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      return NextResponse.json({ run });
    }
    const [runs, keyOk] = await Promise.all([listRuns(), hasApiKey()]);
    return NextResponse.json({ runs, hasApiKey: keyOk });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!(await hasApiKey())) {
      return NextResponse.json(
        {
          error:
            "未配置 API Key。请到「大模型配置」页填写，或设置环境变量 DEEPSEEK_API_KEY。",
        },
        { status: 400 },
      );
    }
    const body = await req.json();
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const run = await runAgent({
      prompt,
      skillName: body.skillName ? String(body.skillName) : null,
      maxSteps: body.maxSteps ? Number(body.maxSteps) : 8,
    });
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
