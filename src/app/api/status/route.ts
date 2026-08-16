import { NextResponse } from "next/server";
import { getLlmConfigPublic } from "@/lib/llm-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getLlmConfigPublic();
    return NextResponse.json(
      {
        hasApiKey: config.hasApiKey,
        model: config.model,
        provider: config.provider,
        baseUrl: config.baseUrl,
        source: config.source,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
