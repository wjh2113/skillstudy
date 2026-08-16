"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LlmConfigPublic, LlmProvider } from "@/lib/types";

type Presets = Record<
  LlmProvider,
  { label: string; baseUrl: string; model: string }
>;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [statusReady, setStatusReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [source, setSource] = useState<LlmConfigPublic["source"]>("default");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState("");

  const [provider, setProvider] = useState<LlmProvider>("deepseek");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");
  const [temperature, setTemperature] = useState(0.2);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/llm", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      const cfg = data.config as LlmConfigPublic;
      setPresets(data.presets);
      setProvider(cfg.provider);
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setTemperature(cfg.temperature);
      setHasApiKey(cfg.hasApiKey);
      setApiKeyMasked(cfg.apiKeyMasked);
      setSource(cfg.source);
      setApiKey("");
      setStatusReady(true);    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(p: LlmProvider) {
    setProvider(p);
    if (presets?.[p]) {
      setBaseUrl(presets[p].baseUrl);
      setModel(presets[p].model);
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          temperature,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      const cfg = data.config as LlmConfigPublic;
      setHasApiKey(cfg.hasApiKey);
      setApiKeyMasked(cfg.apiKeyMasked);
      setSource(cfg.source);
      setApiKey("");
      setOkMsg("已保存到 data/llm-config.json");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onClearKey() {
    if (!confirm("清除已保存的 API Key？")) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearApiKey: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "清除失败");
      const cfg = data.config as LlmConfigPublic;
      setHasApiKey(cfg.hasApiKey);
      setApiKeyMasked(cfg.apiKeyMasked);
      setSource(cfg.source);
      setApiKey("");
      setOkMsg("API Key 已清除");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setError(null);
    setOkMsg(null);
    try {
      // Save current form first so test uses latest values
      const saveRes = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          temperature,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "保存失败");

      const cfg = saveData.config as LlmConfigPublic;
      setHasApiKey(cfg.hasApiKey);
      setApiKeyMasked(cfg.apiKeyMasked);
      setSource(cfg.source);
      setApiKey("");

      const res = await fetch("/api/settings/llm", { method: "POST", body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "连通性测试失败");
      }
      setOkMsg(`连通正常 · 模型 ${data.model} · 回复：${data.reply || "(空)"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-6 pb-4 fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-xs tracking-[0.15em] uppercase text-[var(--muted)] hover:text-[var(--accent)]"
            >
              ← Skill Lab
            </Link>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-ink-950 mt-2">
              大模型配置
            </h1>
            <p className="mt-2 max-w-xl text-[var(--muted)] text-sm leading-relaxed">
              配置 API Key、Base URL 与模型。优先使用本页保存的设置，其次读取环境变量。
            </p>
          </div>
          <div className="panel rounded-lg px-4 py-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${hasApiKey ? "bg-[var(--ok)]" : "bg-[var(--err)]"}`}
              />
              <span className="mono text-xs">
                {!statusReady
                  ? "检查中…"
                  : hasApiKey
                    ? apiKeyMasked || "key set"
                    : "未配置 Key"}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              来源 · {source}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mb-3 rounded-lg border border-[var(--err)]/30 bg-[#f8ebe8] px-4 py-3 text-sm text-[var(--err)]">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="mx-6 mb-3 rounded-lg border border-[var(--ok)]/30 bg-[#e8f3ec] px-4 py-3 text-sm text-[var(--ok)]">
          {okMsg}
        </div>
      )}

      <main className="flex-1 px-6 pb-10">
        <div className="panel rounded-xl max-w-2xl p-6 fade-up space-y-5">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">加载中…</p>
          ) : (
            <>
              <div>
                <div className="text-sm text-[var(--muted)] mb-2">预设</div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["deepseek", "DeepSeek"],
                      ["openai-compatible", "OpenAI 兼容"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyPreset(id)}
                      className={`px-3 py-1.5 rounded-md text-sm ${
                        provider === id
                          ? "bg-ink-900 text-ink-50"
                          : "border border-[var(--line)] hover:bg-[#e8eef3]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-sm">
                <span className="text-[var(--muted)]">Base URL</span>
                <input
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 mono text-sm"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                />
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  请求路径为{" "}
                  <span className="mono">Base URL + /v1/chat/completions</span>
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-[var(--muted)]">模型</span>
                <input
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 mono text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-chat"
                />
              </label>

              <label className="block text-sm">
                <span className="text-[var(--muted)]">
                  Temperature · {temperature.toFixed(1)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  className="mt-2 w-full"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                />
              </label>

              <label className="block text-sm">
                <span className="text-[var(--muted)]">API Key</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 mono text-sm"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      hasApiKey
                        ? `已保存 ${apiKeyMasked} · 留空不改`
                        : "sk-..."
                    }
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="rounded-md border border-[var(--line)] px-3 text-sm hover:bg-[#e8eef3]"
                  >
                    {showKey ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || testing}
                  className="rounded-md bg-[var(--accent)] text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={onTest}
                  disabled={saving || testing}
                  className="rounded-md bg-ink-900 text-ink-50 px-4 py-2 text-sm hover:bg-ink-800 disabled:opacity-50"
                >
                  {testing ? "测试中…" : "保存并测试连通"}
                </button>
                {hasApiKey && (
                  <button
                    type="button"
                    onClick={onClearKey}
                    disabled={saving || testing}
                    className="rounded-md border border-[var(--err)]/40 text-[var(--err)] px-4 py-2 text-sm hover:bg-[#f8ebe8] disabled:opacity-50"
                  >
                    清除 Key
                  </button>
                )}
              </div>

              <p className="text-xs text-[var(--muted)] leading-relaxed pt-2 border-t border-[var(--line)]">
                Key 保存在本地{" "}
                <span className="mono">data/llm-config.json</span>
                ，已加入 .gitignore。也可继续用{" "}
                <span className="mono">.env.local</span> 的{" "}
                <span className="mono">DEEPSEEK_API_KEY</span>。
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
