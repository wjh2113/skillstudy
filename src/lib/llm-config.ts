import fs from "fs/promises";
import { DATA_DIR, LLM_CONFIG_FILE } from "./paths";
import type { LlmConfig, LlmConfigPublic, LlmProvider } from "./types";

export const LLM_PRESETS: Record<
  LlmProvider,
  { label: string; baseUrl: string; model: string }
> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  "openai-compatible": {
    label: "OpenAI 兼容",
    baseUrl: "https://api.openai.com",
    model: "gpt-4o-mini",
  },
};

const DEFAULTS: LlmConfig = {
  provider: "deepseek",
  apiKey: "",
  baseUrl: LLM_PRESETS.deepseek.baseUrl,
  model: LLM_PRESETS.deepseek.model,
  temperature: 0.2,
};

function clampTemperature(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return 0.2;
  return Math.min(2, Math.max(0, v));
}

function normalizeProvider(v: unknown): LlmProvider {
  return v === "openai-compatible" ? "openai-compatible" : "deepseek";
}

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (!t) return "";
  if (t.length <= 8) return "********";
  return `${t.slice(0, 3)}****${t.slice(-4)}`;
}

async function readFileConfig(): Promise<Partial<LlmConfig> | null> {
  try {
    const raw = await fs.readFile(LLM_CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Partial<LlmConfig>;
  } catch {
    return null;
  }
}

/** Resolve runtime config: file overrides env overrides defaults. */
export async function getLlmConfig(): Promise<LlmConfig & { source: LlmConfigPublic["source"] }> {
  const file = await readFileConfig();

  const envKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "";
  const envBase =
    process.env.DEEPSEEK_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "";
  const envModel =
    process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || "";

  if (file) {
    return {
      provider: normalizeProvider(file.provider),
      apiKey: String(file.apiKey || envKey || ""),
      baseUrl: String(file.baseUrl || envBase || DEFAULTS.baseUrl).replace(
        /\/$/,
        "",
      ),
      model: String(file.model || envModel || DEFAULTS.model),
      temperature: clampTemperature(
        file.temperature ?? DEFAULTS.temperature,
      ),
      source: "file",
    };
  }

  if (envKey || envBase || envModel) {
    return {
      provider: "deepseek",
      apiKey: envKey,
      baseUrl: (envBase || DEFAULTS.baseUrl).replace(/\/$/, ""),
      model: envModel || DEFAULTS.model,
      temperature: DEFAULTS.temperature,
      source: "env",
    };
  }

  return { ...DEFAULTS, source: "default" };
}

export async function getLlmConfigPublic(): Promise<LlmConfigPublic> {
  const cfg = await getLlmConfig();
  return {
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    temperature: cfg.temperature,
    hasApiKey: Boolean(cfg.apiKey.trim()),
    apiKeyMasked: maskApiKey(cfg.apiKey),
    source: cfg.source,
  };
}

export async function saveLlmConfig(
  input: Partial<LlmConfig> & { clearApiKey?: boolean },
): Promise<LlmConfigPublic> {
  const current = await getLlmConfig();
  const provider = normalizeProvider(input.provider ?? current.provider);

  let apiKey = current.apiKey;
  if (input.clearApiKey) {
    apiKey = "";
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    // Ignore placeholder / masked values
    const next = input.apiKey.trim();
    if (!next.includes("*") && !next.includes("•") && next !== current.apiKey) {
      apiKey = next;
    }
  }

  const next: LlmConfig = {
    provider,
    apiKey,
    baseUrl: String(input.baseUrl ?? current.baseUrl)
      .trim()
      .replace(/\/$/, ""),
    model: String(input.model ?? current.model).trim() || DEFAULTS.model,
    temperature: clampTemperature(
      input.temperature ?? current.temperature,
    ),
  };

  if (!next.baseUrl) {
    next.baseUrl = LLM_PRESETS[provider].baseUrl;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LLM_CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return getLlmConfigPublic();
}

export async function hasApiKey(): Promise<boolean> {
  const cfg = await getLlmConfig();
  return Boolean(cfg.apiKey.trim());
}
