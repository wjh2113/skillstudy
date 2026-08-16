"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ExternalSkillItem,
  ExternalSkillSource,
  RunRecord,
  SkillDetail,
  SkillFileNode,
  SkillSummary,
  TraceEvent,
} from "@/lib/types";

type Tab = "files" | "load" | "create" | "download" | "run";

export default function HomePage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [tab, setTab] = useState<Tab>("files");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [model, setModel] = useState("deepseek-chat");
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [activeRun, setActiveRun] = useState<RunRecord | null>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);

  const [externalSources, setExternalSources] = useState<ExternalSkillSource[]>(
    [],
  );
  const [externalSkills, setExternalSkills] = useState<ExternalSkillItem[]>([]);
  const [overwriteLoad, setOverwriteLoad] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    withScripts: true,
  });
  const [downloadForm, setDownloadForm] = useState({
    url: "",
    name: "",
  });

  const refreshExternal = useCallback(async () => {
    const res = await fetch("/api/skills/external", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to list external skills");
    setExternalSources(data.sources || []);
    setExternalSkills(data.skills || []);
  }, []);

  const refreshSkills = useCallback(async () => {
    const res = await fetch("/api/skills", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to list skills");
    setSkills(data.skills);
  }, []);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/status", { cache: "no-store" });
    const data = await res.json();
    setHasApiKey(Boolean(data.hasApiKey));
    if (data.model) setModel(data.model);
  }, []);

  const refreshRuns = useCallback(async () => {
    const res = await fetch("/api/runs", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setRuns(data.runs || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refreshSkills(), refreshRuns(), refreshExternal()]);
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [refreshSkills, refreshStatus, refreshRuns, refreshExternal]);

  useEffect(() => {
    const onFocus = () => {
      refreshStatus().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshStatus]);

  const loadDetail = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    setSelected(name);
    setDetail(null);
    setFilePath(null);
    setFileContent("");
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load skill");
      setDetail(data.skill);
      setFilePath("SKILL.md");
      const fileRes = await fetch(
        `/api/skills/${encodeURIComponent(name)}/file?path=${encodeURIComponent("SKILL.md")}`,
        { cache: "no-store" },
      );
      const fileData = await fileRes.json();
      if (!fileRes.ok) {
        throw new Error(fileData.error || "Failed to read SKILL.md");
      }
      setFileContent(fileData.file.content);
      setTab("files");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const openFile = useCallback(
    async (name: string, path: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/skills/${encodeURIComponent(name)}/file?path=${encodeURIComponent(path)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to read file");
        setFilePath(path);
        setFileContent(data.file.content);
        setTab("files");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onLoadExternal = async (item: ExternalSkillItem) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePath: item.path,
          overwrite: overwriteLoad,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      await Promise.all([refreshSkills(), refreshExternal()]);
      await loadDetail(data.skill.path || data.skill.name);
      setTab("files");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const onCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      await refreshSkills();
      await loadDetail(data.skill.path || data.skill.name);
      setCreateForm({ name: "", description: "", withScripts: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: downloadForm.url,
          name: downloadForm.name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Download failed");
      await refreshSkills();
      await loadDetail(data.skill.path || data.skill.name);
      setDownloadForm({ url: "", name: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (selected === name) {
        setSelected(null);
        setDetail(null);
        setFilePath(null);
        setFileContent("");
      }
      await refreshSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const onRun = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setError(null);
    setTab("run");
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          skillName: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setActiveRun(data.run);
      await refreshRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const selectedSummary = useMemo(
    () => skills.find((s) => s.path === selected) || null,
    [skills, selected],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 pt-6 pb-4 fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
              Personal research
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-ink-950">
              Skill Lab
            </h1>
            <p className="mt-2 max-w-xl text-[var(--muted)] text-sm leading-relaxed">
              加载、创建、下载 Cursor 风格 skill；用 DeepSeek 模拟执行，查看文件与调用轨迹。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/settings"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              大模型配置
            </Link>
            <div className="panel rounded-lg px-4 py-3 text-sm">
              <button
                type="button"
                onClick={() => refreshStatus().catch(() => {})}
                className="flex items-center gap-2"
                title="点击刷新状态"
              >
                <span
                  className={`h-2 w-2 rounded-full ${hasApiKey ? "bg-[var(--ok)]" : "bg-[var(--err)]"}`}
                />
                <span className="mono text-xs">
                  {hasApiKey ? model : "未配置 API Key"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mb-3 rounded-lg border border-[var(--err)]/30 bg-[#f8ebe8] px-4 py-3 text-sm text-[var(--err)]">
          {error}
        </div>
      )}

      <main className="flex-1 px-6 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Skill list */}
        <aside className="lg:col-span-3 panel rounded-xl overflow-hidden flex flex-col min-h-[420px] fade-up">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
            <h2 className="font-display text-lg">Skills</h2>
            <span className="text-xs text-[var(--muted)]">{skills.length}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {skills.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">
                还没有 skill。点「加载」导入本机已安装的 skill。
              </p>
            ) : (
              <ul>
                {skills.map((s) => (
                  <li key={s.path}>
                    <button
                      type="button"
                      onClick={() => loadDetail(s.path)}
                      className={`w-full text-left px-4 py-3 border-b border-[var(--line)]/70 transition-colors ${
                        selected === s.path
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[#e8eef3]"
                      }`}
                    >
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-[var(--muted)] line-clamp-2 mt-1">
                        {s.description || "No description"}
                      </div>
                      <div className="mt-2 flex gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                        <span>{s.fileCount} files</span>
                        {s.hasScripts && <span>scripts</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-3 border-t border-[var(--line)] flex gap-2">
            <button
              type="button"
              onClick={() => setTab("load")}
              className="flex-1 rounded-md bg-[var(--accent)] text-white text-sm py-2 hover:opacity-90"
            >
              加载
            </button>
            <button
              type="button"
              onClick={() => setTab("create")}
              className="flex-1 rounded-md bg-ink-900 text-ink-50 text-sm py-2 hover:bg-ink-800"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setTab("download")}
              className="flex-1 rounded-md border border-[var(--line)] text-sm py-2 hover:bg-[#e8eef3]"
            >
              下载
            </button>
          </div>
        </aside>

        {/* Center */}
        <section className="lg:col-span-5 panel rounded-xl overflow-hidden flex flex-col min-h-[420px] fade-up">
          <div className="px-4 py-3 border-b border-[var(--line)] flex flex-wrap items-center gap-2">
            {(
              [
                ["files", "文件"],
                ["load", "加载"],
                ["create", "创建"],
                ["download", "下载"],
                ["run", "运行"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  tab === id
                    ? "bg-ink-900 text-ink-50"
                    : "text-[var(--muted)] hover:bg-[#e8eef3]"
                }`}
              >
                {label}
              </button>
            ))}
            {loading && (
              <span className="ml-auto text-xs text-[var(--muted)]">加载中…</span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {tab === "files" && (
              <FilesPanel
                detail={detail}
                selectedSummary={selectedSummary}
                filePath={filePath}
                fileContent={fileContent}
                onOpenFile={(p) => selected && openFile(selected, p)}
                onDelete={() => selected && onDelete(selected)}
              />
            )}
            {tab === "load" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl">从本机加载 Skill</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      扫描 Cursor / Agents / Codex / Claude 等已安装目录，复制到本项目{" "}
                      <span className="mono">skills/</span>。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      refreshExternal()
                        .catch((err) =>
                          setError(
                            err instanceof Error ? err.message : String(err),
                          ),
                        )
                        .finally(() => setLoading(false));
                    }}
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[#e8eef3]"
                  >
                    刷新扫描
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {externalSources.map((s) => (
                    <span
                      key={s.id}
                      className={`rounded-md border px-2 py-1 mono ${
                        s.exists
                          ? "border-[var(--ok)]/40 text-[var(--ok)]"
                          : "border-[var(--line)] opacity-60"
                      }`}
                    >
                      {s.label}
                      {s.exists ? "" : " · 无"}
                    </span>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overwriteLoad}
                    onChange={(e) => setOverwriteLoad(e.target.checked)}
                  />
                  若 Lab 中已存在同名 skill，允许覆盖
                </label>

                {externalSkills.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    未发现可加载的本机 skill（需目录内有 SKILL.md）。
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-[420px] overflow-auto">
                    {externalSkills.map((item) => (
                      <li
                        key={`${item.sourceId}:${item.path}`}
                        className="rounded-lg border border-[var(--line)] bg-white/70 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                              {item.description || "无描述"}
                            </div>
                            <div className="mono text-[10px] text-[var(--muted)] mt-2">
                              {item.sourceLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={loading || (item.alreadyLoaded && !overwriteLoad)}
                            onClick={() => onLoadExternal(item)}
                            className="shrink-0 rounded-md bg-ink-900 text-ink-50 px-3 py-1.5 text-sm hover:bg-ink-800 disabled:opacity-40"
                          >
                            {item.alreadyLoaded ? "已加载" : "加载到 Lab"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === "create" && (
              <div className="max-w-lg space-y-4">
                <h3 className="font-display text-xl">创建 Skill</h3>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">名称</span>
                  <input
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 mono text-sm"
                    placeholder="my-skill"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">描述</span>
                  <textarea
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm min-h-[100px]"
                    placeholder="What it does and when to use it"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.withScripts}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        withScripts: e.target.checked,
                      }))
                    }
                  />
                  附带示例 scripts/hello.py
                </label>
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={loading}
                  className="rounded-md bg-[var(--accent)] text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  创建
                </button>
              </div>
            )}
            {tab === "download" && (
              <div className="max-w-lg space-y-4">
                <h3 className="font-display text-xl">下载 Skill</h3>
                <p className="text-sm text-[var(--muted)]">
                  支持指向 <span className="mono">SKILL.md</span> 的 raw / blob URL（如
                  GitHub raw）。
                </p>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">URL</span>
                  <input
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    placeholder="https://raw.githubusercontent.com/.../SKILL.md"
                    value={downloadForm.url}
                    onChange={(e) =>
                      setDownloadForm((f) => ({ ...f, url: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">本地名称（可选）</span>
                  <input
                    className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 mono text-sm"
                    placeholder="optional-name"
                    value={downloadForm.name}
                    onChange={(e) =>
                      setDownloadForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={loading}
                  className="rounded-md bg-[var(--accent)] text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  下载到 skills/
                </button>
              </div>
            )}
            {tab === "run" && (
              <div className="space-y-4">
                <h3 className="font-display text-xl">模拟执行</h3>
                <p className="text-sm text-[var(--muted)]">
                  DeepSeek 可调用 list/load/read/run_script。当前聚焦：{" "}
                  <span className="mono text-ink-900">
                    {selected || "（未选择 skill）"}
                  </span>
                </p>
                <textarea
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm min-h-[120px]"
                  placeholder="例如：加载当前 skill，按说明执行 scripts，并总结结果"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={onRun}
                  disabled={running || !prompt.trim()}
                  className="rounded-md bg-ink-900 text-ink-50 px-4 py-2 text-sm hover:bg-ink-800 disabled:opacity-50"
                >
                  {running ? "运行中…" : "开始运行"}
                </button>
                {!hasApiKey && (
                  <p className="text-sm text-[var(--err)]">
                    请先到{" "}
                    <Link href="/settings" className="underline">
                      大模型配置
                    </Link>{" "}
                    填写 API Key。
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Trace */}
        <aside className="lg:col-span-4 panel rounded-xl overflow-hidden flex flex-col min-h-[420px] fade-up">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
            <h2 className="font-display text-lg">调用过程</h2>
            {activeRun && (
              <StatusPill status={activeRun.status} running={running} />
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {!activeRun ? (
              <p className="text-sm text-[var(--muted)] p-2">
                运行后这里会显示 tool call、脚本输出与最终结果。
              </p>
            ) : (
              activeRun.events.map((ev) => <TraceCard key={ev.id} event={ev} />)
            )}
          </div>
          {runs.length > 0 && (
            <div className="border-t border-[var(--line)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">
                最近运行
              </div>
              <div className="flex flex-wrap gap-2">
                {runs.slice(0, 6).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setActiveRun(r);
                      setTab("run");
                    }}
                    className={`mono text-[10px] px-2 py-1 rounded border border-[var(--line)] ${
                      activeRun?.id === r.id
                        ? "bg-[var(--accent-soft)]"
                        : "hover:bg-[#e8eef3]"
                    }`}
                  >
                    {r.id.slice(0, 8)} · {r.status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function StatusPill({
  status,
  running,
}: {
  status: RunRecord["status"];
  running: boolean;
}) {
  const label = running ? "running" : status;
  const color =
    label === "completed"
      ? "var(--ok)"
      : label === "failed"
        ? "var(--err)"
        : "var(--tool)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs mono">
      <span
        className={`h-1.5 w-1.5 rounded-full ${label === "running" ? "running-dot" : ""}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function TraceCard({ event }: { event: TraceEvent }) {
  const color =
    event.kind === "error"
      ? "var(--err)"
      : event.kind === "tool_call" || event.kind === "script"
        ? "var(--tool)"
        : event.kind === "done"
          ? "var(--ok)"
          : "var(--muted)";

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color }}>
          {event.kind}
        </span>
        <span className="mono text-[10px] text-[var(--muted)]">
          {new Date(event.at).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm mt-1 font-medium">{event.title}</div>
      {event.detail && (
        <pre className="mt-2 mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-[var(--muted)] max-h-48 overflow-auto">
          {event.detail}
        </pre>
      )}
    </article>
  );
}

function FilesPanel({
  detail,
  selectedSummary,
  filePath,
  fileContent,
  onOpenFile,
  onDelete,
}: {
  detail: SkillDetail | null;
  selectedSummary: SkillSummary | null;
  filePath: string | null;
  fileContent: string;
  onOpenFile: (path: string) => void;
  onDelete: () => void;
}) {
  if (!detail) {
    return (
      <p className="text-sm text-[var(--muted)]">
        从左侧选择一个 skill，查看文件树与内容。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
      <div className="md:col-span-2 space-y-3">
        <div>
          <h3 className="font-display text-xl">{detail.name}</h3>
          <p className="text-sm text-[var(--muted)] mt-1">{detail.description}</p>
          {selectedSummary && (
            <p className="text-xs text-[var(--muted)] mt-2 mono">
              {selectedSummary.fileCount} files · updated{" "}
              {new Date(selectedSummary.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white/60 p-2 max-h-64 overflow-auto">
          <FileTree nodes={detail.tree} onOpen={onOpenFile} active={filePath} />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-[var(--err)] hover:underline"
        >
          删除此 skill
        </button>
      </div>
      <div className="md:col-span-3 flex flex-col min-h-[280px]">
        <div className="mono text-xs text-[var(--muted)] mb-2">
          {filePath || "—"}
        </div>
        <pre className="flex-1 overflow-auto rounded-lg border border-[var(--line)] bg-[#1a211f] text-[#e8e2d6] p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
          {fileContent || "（空文件）"}
        </pre>
      </div>
    </div>
  );
}

function FileTree({
  nodes,
  onOpen,
  active,
  depth = 0,
}: {
  nodes: SkillFileNode[];
  onOpen: (path: string) => void;
  active: string | null;
  depth?: number;
}) {
  return (
    <ul className="text-sm">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.type === "dir" ? (
            <div>
              <div
                className="py-1 text-[var(--muted)]"
                style={{ paddingLeft: depth * 12 }}
              >
                {node.name}/
              </div>
              {node.children && (
                <FileTree
                  nodes={node.children}
                  onOpen={onOpen}
                  active={active}
                  depth={depth + 1}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(node.path)}
              className={`w-full text-left py-1 mono text-xs hover:text-[var(--accent)] ${
                active === node.path ? "text-[var(--accent)] font-medium" : ""
              }`}
              style={{ paddingLeft: depth * 12 }}
            >
              {node.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
