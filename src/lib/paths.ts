import path from "path";

export const ROOT = process.cwd();
export const SKILLS_DIR = path.join(ROOT, "skills");
export const RUNS_DIR = path.join(ROOT, "runs");
export const DATA_DIR = path.join(ROOT, "data");
export const LLM_CONFIG_FILE = path.join(DATA_DIR, "llm-config.json");

export function skillDir(name: string): string {
  return path.join(SKILLS_DIR, name);
}

export function runFile(id: string): string {
  return path.join(RUNS_DIR, `${id}.json`);
}
