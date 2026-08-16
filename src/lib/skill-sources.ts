import fs from "fs/promises";
import os from "os";
import path from "path";
import matter from "gray-matter";
import { SKILLS_DIR, skillDir } from "./paths";
import { assertSkillName, getSkill, listSkills } from "./skills";
import type { ExternalSkillItem, ExternalSkillSource, SkillDetail } from "./types";

const SKIP_DIRS = new Set([".system", "node_modules", ".git"]);

function home(...parts: string[]): string {
  return path.join(os.homedir(), ...parts);
}

export function knownSkillSources(): ExternalSkillSource[] {
  const defs: Array<Omit<ExternalSkillSource, "exists">> = [
    {
      id: "agents",
      label: "~/.agents/skills",
      root: home(".agents", "skills"),
    },
    {
      id: "cursor",
      label: "~/.cursor/skills",
      root: home(".cursor", "skills"),
    },
    {
      id: "cursor-builtin",
      label: "~/.cursor/skills-cursor",
      root: home(".cursor", "skills-cursor"),
    },
    {
      id: "codex",
      label: "~/.codex/skills",
      root: home(".codex", "skills"),
    },    {
      id: "claude",
      label: "~/.claude/skills",
      root: home(".claude", "skills"),
    },
    {
      id: "project-cursor",
      label: "项目 .cursor/skills",
      root: path.join(process.cwd(), ".cursor", "skills"),
    },
  ];

  return defs.map((d) => ({ ...d, exists: false }));
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

function isAllowedSourceRoot(root: string): boolean {
  const resolved = path.resolve(root);
  const allowed = knownSkillSources().map((s) => path.resolve(s.root));
  return allowed.some(
    (a) => resolved === a || resolved.startsWith(a + path.sep),
  );
}

export async function listExternalSources(): Promise<ExternalSkillSource[]> {
  const sources = knownSkillSources();
  for (const s of sources) {
    s.exists = await pathExists(s.root);
  }
  return sources;
}

export async function listExternalSkills(): Promise<{
  sources: ExternalSkillSource[];
  skills: ExternalSkillItem[];
}> {
  const sources = await listExternalSources();
  const loaded = new Set((await listSkills()).map((s) => s.name));
  const skills: ExternalSkillItem[] = [];

  for (const source of sources) {
    if (!source.exists) continue;
    let entries;
    try {
      entries = await fs.readdir(source.root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;

      const dir = path.join(source.root, entry.name);
      const skillMd = path.join(dir, "SKILL.md");
      if (!(await pathExists(skillMd))) continue;

      let name = entry.name;
      let description = "";
      try {
        const raw = await fs.readFile(skillMd, "utf8");
        const { data } = matter(raw);
        if (typeof data.name === "string" && data.name) name = data.name;
        if (typeof data.description === "string") description = data.description;
      } catch {
        // keep defaults
      }

      skills.push({
        name,
        description,
        sourceId: source.id,
        sourceLabel: source.label,
        path: dir,
        alreadyLoaded: loaded.has(name) || loaded.has(entry.name),
      });
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { sources, skills };
}

/** Copy an external skill directory into the lab skills/ folder. */
export async function loadExternalSkill(input: {
  sourcePath: string;
  name?: string;
  overwrite?: boolean;
}): Promise<SkillDetail> {
  const sourcePath = path.resolve(input.sourcePath);
  if (!isAllowedSourceRoot(sourcePath)) {
    throw new Error("只能从已知的本机 skill 目录加载");
  }

  const skillMd = path.join(sourcePath, "SKILL.md");
  if (!(await pathExists(skillMd))) {
    throw new Error("目标目录没有 SKILL.md");
  }

  let name = (input.name || path.basename(sourcePath)).toLowerCase();
  try {
    const raw = await fs.readFile(skillMd, "utf8");
    const { data } = matter(raw);
    if (!input.name && typeof data.name === "string" && data.name) {
      name = String(data.name).toLowerCase();
    }
  } catch {
    // keep basename
  }

  assertSkillName(name);
  await fs.mkdir(SKILLS_DIR, { recursive: true });
  const dest = skillDir(name);

  if (await pathExists(dest)) {
    if (!input.overwrite) {
      throw new Error(`Skill 已存在于 Lab：${name}。可勾选覆盖后重试。`);
    }
    await fs.rm(dest, { recursive: true, force: true });
  }

  await copyDir(sourcePath, dest);
  return getSkill(name);
}
