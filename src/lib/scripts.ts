import { spawn } from "child_process";
import path from "path";
import { skillDir } from "./paths";
import { assertSkillName } from "./skills";

export interface ScriptResult {
  script: string;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

function resolveRunner(scriptName: string): { cmd: string; args: string[] } {
  const ext = path.extname(scriptName).toLowerCase();
  if (ext === ".py") return { cmd: "python", args: [] };
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return { cmd: "node", args: [] };
  }
  if (ext === ".sh") {
    return { cmd: "bash", args: [] };
  }
  if (ext === ".ps1") {
    return { cmd: "powershell", args: ["-NoProfile", "-File"] };
  }
  throw new Error(`Unsupported script type: ${ext || "(none)"}`);
}

export async function runSkillScript(
  skillName: string,
  scriptName: string,
  argv: string[] = [],
  timeoutMs = 30_000,
): Promise<ScriptResult> {
  assertSkillName(skillName);

  const safeScript = scriptName.replace(/\\/g, "/");
  if (
    safeScript.includes("..") ||
    safeScript.includes("/") ||
    path.isAbsolute(safeScript)
  ) {
    throw new Error("Script must be a filename under scripts/");
  }

  const full = path.join(skillDir(skillName), "scripts", safeScript);
  const { cmd, args: prefix } = resolveRunner(safeScript);
  const args = [...prefix, full, ...argv];
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: skillDir(skillName),
      env: { ...process.env, SKILL_NAME: skillName },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new Error(`Script timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (buf: Buffer) => {
      stdout += buf.toString("utf8");
    });
    child.stderr.on("data", (buf: Buffer) => {
      stderr += buf.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve({
          script: safeScript,
          command: [cmd, ...args].join(" "),
          exitCode: code,
          stdout: stdout.slice(0, 50_000),
          stderr: stderr.slice(0, 50_000),
          durationMs: Date.now() - started,
        });
      }
    });
  });
}
