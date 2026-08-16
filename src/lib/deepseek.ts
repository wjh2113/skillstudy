import { getLlmConfig } from "./llm-config";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResult {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: string;
  model: string;
  raw: unknown;
}

export async function chatCompletion(opts: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
}): Promise<ChatCompletionResult> {
  const cfg = await getLlmConfig();
  if (!cfg.apiKey.trim()) {
    throw new Error(
      "未配置 API Key。请打开「大模型配置」页填写，或设置环境变量 DEEPSEEK_API_KEY。",
    );
  }

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: opts.messages,
    temperature: opts.temperature ?? cfg.temperature,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json();
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `LLM HTTP ${res.status}`;
    throw new Error(msg);
  }

  const choice = (
    raw as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: ToolCall[];
        };
        finish_reason?: string;
      }>;
      model?: string;
    }
  ).choices?.[0];

  if (!choice) {
    throw new Error("模型返回为空（no choices）");
  }

  return {
    content: choice.message?.content ?? null,
    tool_calls: choice.message?.tool_calls,
    finish_reason: choice.finish_reason || "stop",
    model: (raw as { model?: string }).model || cfg.model,
    raw,
  };
}
