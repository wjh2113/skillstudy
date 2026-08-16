import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/deepseek";
import {
  getLlmConfigPublic,
  LLM_PRESETS,
  saveLlmConfig,
} from "@/lib/llm-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getLlmConfigPublic();
    return NextResponse.json(
      { config, presets: LLM_PRESETS },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const config = await saveLlmConfig({
      provider: body.provider,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      model: body.model,
      temperature: body.temperature,
      clearApiKey: Boolean(body.clearApiKey),
    });
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // Optionally save first if payload includes settings
    if (body.save) {
      await saveLlmConfig({
        provider: body.provider,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
        temperature: body.temperature,
      });
    }

    const result = await chatCompletion({
      messages: [
        {
          role: "user",
          content: "Reply with exactly: ok",
        },
      ],
      temperature: 0,
    });

    return NextResponse.json({
      ok: true,
      model: result.model,
      reply: result.content,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
}
