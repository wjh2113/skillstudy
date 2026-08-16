import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { SKILLS_DIR, skillDir } from "./paths";
import type {
  CreateSkillInput,
  DownloadSkillInput,
  SkillDetail,
  SkillFileNode,
  SkillMeta,
  SkillSummary,
} from "./types";

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function assertSkillName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(
      "Skill name must be lowercase letters, numbers, hyphens; max 64 chars.",
    );
  }
}

async function ensureSkillsDir(): Promise<void> {
  await fs.mkdir(SKILLS_DIR, { recursive: true });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += await countFiles(full);
    else count += 1;
  }
  return count;
}

async function buildTree(dir: string, rel = ""): Promise<SkillFileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const nodes: SkillFileNode[] = [];
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: "dir",
        children: await buildTree(full, childRel),
      });
    } else {
      nodes.push({ name: entry.name, path: childRel, type: "file" });
    }
  }
  return nodes;
}

export async function listSkills(): Promise<SkillSummary[]> {
  await ensureSkillsDir();
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(SKILLS_DIR, entry.name);
    const skillMd = path.join(dir, "SKILL.md");
    if (!(await pathExists(skillMd))) continue;

    const raw = await fs.readFile(skillMd, "utf8");
    const { data } = matter(raw);
    const meta = data as SkillMeta;
    const scriptsDir = path.join(dir, "scripts");
    const stat = await fs.stat(skillMd);

    skills.push({
      name: meta.name || entry.name,
      description: meta.description || "",
      path: entry.name,
      hasScripts: await pathExists(scriptsDir),
      fileCount: await countFiles(dir),
      updatedAt: stat.mtime.toISOString(),
    });
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export async function getSkill(name: string): Promise<SkillDetail> {
  assertSkillName(name);
  const dir = skillDir(name);
  const skillMd = path.join(dir, "SKILL.md");
  if (!(await pathExists(skillMd))) {
    throw new Error(`Skill not found: ${name}`);
  }

  const raw = await fs.readFile(skillMd, "utf8");
  const { data, content } = matter(raw);
  const meta = data as SkillMeta;
  const scriptsDir = path.join(dir, "scripts");
  const stat = await fs.stat(skillMd);

  return {
    name: meta.name || name,
    description: meta.description || "",
    path: name,
    hasScripts: await pathExists(scriptsDir),
    fileCount: await countFiles(dir),
    updatedAt: stat.mtime.toISOString(),
    meta,
    body: content.trim(),
    tree: await buildTree(dir),
  };
}

export async function readSkillFile(
  name: string,
  filePath: string,
): Promise<{ path: string; content: string; language: string }> {
  assertSkillName(name);
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid file path");
  }

  const root = path.resolve(skillDir(name));
  const full = path.resolve(root, normalized);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Path escapes skill directory");
  }
  if (!(await pathExists(full))) {
    throw new Error(`File not found: ${normalized}`);
  }

  const content = await fs.readFile(full, "utf8");
  const ext = path.extname(normalized).slice(1).toLowerCase();
  const language =
    ext === "md"
      ? "markdown"
      : ext === "py"
        ? "python"
        : ext === "ts" || ext === "tsx"
          ? "typescript"
          : ext === "js" || ext === "mjs" || ext === "cjs"
            ? "javascript"
            : ext === "json"
              ? "json"
              : ext === "sh"
                ? "bash"
                : "text";

  return { path: normalized, content, language };
}

export async function createSkill(input: CreateSkillInput): Promise<SkillDetail> {
  const name = input.name.trim().toLowerCase();
  assertSkillName(name);
  if (!input.description?.trim()) {
    throw new Error("Description is required");
  }

  await ensureSkillsDir();
  const dir = skillDir(name);
  if (await pathExists(dir)) {
    throw new Error(`Skill already exists: ${name}`);
  }

  await fs.mkdir(dir, { recursive: true });

  const frontmatter = [
    "---",
    `name: ${name}`,
    `description: >-`,
    `  ${input.description.trim().replace(/\n/g, "\n  ")}`,
    ...(input.disableModelInvocation === false
      ? []
      : ["disable-model-invocation: true"]),
    "---",
    "",
  ].join("\n");

  const body =
    input.body?.trim() ||
    [
      `# ${name}`,
      "",
      "## Instructions",
      "",
      "Describe step-by-step guidance for the agent here.",
      "",
      "## Examples",
      "",
      "Add concrete usage examples.",
      "",
    ].join("\n");

  await fs.writeFile(path.join(dir, "SKILL.md"), frontmatter + body, "utf8");

  if (input.withScripts) {
    const scripts = path.join(dir, "scripts");
    await fs.mkdir(scripts, { recursive: true });
    await fs.writeFile(
      path.join(scripts, "hello.py"),
      [
        "#!/usr/bin/env python3",
        '"""Sample script for Skill Lab local execution."""',
        "import json",
        "import sys",
        "",
        "",
        "def main() -> None:",
        "    payload = {",
        '        "ok": True,',
        '        "argv": sys.argv[1:],',
        '        "message": "hello from skill script",',
        "    }",
        "    print(json.dumps(payload, ensure_ascii=False))",
        "",
        "",
        'if __name__ == "__main__":',
        "    main()",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  return getSkill(name);
}

export async function deleteSkill(name: string): Promise<void> {
  assertSkillName(name);
  const dir = skillDir(name);
  if (!(await pathExists(dir))) {
    throw new Error(`Skill not found: ${name}`);
  }
  await fs.rm(dir, { recursive: true, force: true });
}

function guessNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "downloaded-skill";
    return last
      .replace(/\.md$/i, "")
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 64);
  } catch {
    return "downloaded-skill";
  }
}

/** Download SKILL.md (and optional sibling files) from a URL into skills/. */
export async function downloadSkill(
  input: DownloadSkillInput,
): Promise<SkillDetail> {
  const url = input.url.trim();
  if (!url) throw new Error("URL is required");

  let name = (input.name || guessNameFromUrl(url)).toLowerCase();
  if (!NAME_RE.test(name)) {
    name = name.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  }
  assertSkillName(name);

  await ensureSkillsDir();
  const dir = skillDir(name);
  if (await pathExists(dir)) {
    throw new Error(`Skill already exists: ${name}`);
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "skillstudy/0.1" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const text = await res.text();
  await fs.mkdir(dir, { recursive: true });

  // If URL points at SKILL.md content or a markdown skill, write as SKILL.md
  const looksLikeSkill =
    text.includes("---") &&
    (/^name:\s*/m.test(text) || /name:\s*[a-z0-9-]+/.test(text));

  if (looksLikeSkill || url.toLowerCase().includes("skill.md")) {
    let content = text;
    // Normalize name in frontmatter if present
    try {
      const parsed = matter(text);
      const data = { ...parsed.data, name };
      if (!data.description) {
        data.description = `Downloaded skill from ${url}`;
      }
      content =
        matter.stringify(parsed.content.trimStart(), data).trimEnd() + "\n";
    } catch {
      content = text;
    }
    await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  } else {
    // Wrap arbitrary markdown as a skill
    const content = [
      "---",
      `name: ${name}`,
      `description: >-`,
      `  Downloaded skill from ${url}`,
      "disable-model-invocation: true",
      "---",
      "",
      text.trim(),
      "",
    ].join("\n");
    await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  }

  // Best-effort: if GitHub blob/raw for a file in a skill folder, try reference.md
  try {
    const base = url.replace(/\/SKILL\.md(\?.*)?$/i, "");
    if (base !== url) {
      for (const sibling of ["reference.md", "examples.md", "README.md"]) {
        const sibUrl = `${base}/${sibling}`;
        const sibRes = await fetch(sibUrl, {
          headers: { "User-Agent": "skillstudy/0.1" },
        });
        if (sibRes.ok) {
          const sibText = await sibRes.text();
          await fs.writeFile(path.join(dir, sibling), sibText, "utf8");
        }
      }
    }
  } catch {
    // ignore sibling fetch errors
  }

  return getSkill(name);
}

export async function listSkillScripts(name: string): Promise<string[]> {
  assertSkillName(name);
  const scripts = path.join(skillDir(name), "scripts");
  if (!(await pathExists(scripts))) return [];
  const entries = await fs.readdir(scripts, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}
