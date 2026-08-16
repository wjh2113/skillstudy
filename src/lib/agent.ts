import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { chatCompletion, type ChatMessage, type ToolDefinition } from "./deepseek";
import { getLlmConfig } from "./llm-config";
import { RUNS_DIR, runFile } from "./paths";
import { runSkillScript } from "./scripts";
import {
  getSkill,
  listSkillScripts,
  listSkills,
  readSkillFile,
} from "./skills";
import type { RunRecord, TraceEvent } from "./types";

async function ensureRunsDir(): Promise<void> {
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

function event(
  kind: TraceEvent["kind"],
  title: string,
  detail?: string,
  data?: unknown,
): TraceEvent {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    kind,
    title,
    detail,
    data,
  };
}

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_skills",
      description: "List all skills available in the local Skill Lab repository.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "Load a skill by name: returns metadata, SKILL.md body, file tree, and scripts.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill directory / name" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_skill_file",
      description: "Read a file inside a skill directory (relative path).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: {
            type: "string",
            description: "Relative path, e.g. SKILL.md or scripts/hello.py",
          },
        },
        required: ["name", "path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_script",
      description:
        "Execute a local script under skills/<name>/scripts/. Supports .py, .js, .sh, .ps1.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
          script: { type: "string", description: "Filename under scripts/, e.g. echo.js" },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Optional argv passed to the script",
          },
        },
        required: ["name", "script"],
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(
  name: string,
  argsJson: string,
): Promise<{ ok: boolean; result: unknown }> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, result: { error: "Invalid JSON arguments" } };
  }

  try {
    switch (name) {
      case "list_skills": {
        const skills = await listSkills();
        return { ok: true, result: skills };
      }
      case "load_skill": {
        const skillName = String(args.name || "");
        const skill = await getSkill(skillName);
        const scripts = await listSkillScripts(skillName);
        return {
          ok: true,
          result: {
            name: skill.name,
            description: skill.description,
            meta: skill.meta,
            body: skill.body,
            tree: skill.tree,
            scripts,
          },
        };
      }
      case "read_skill_file": {
        const file = await readSkillFile(
          String(args.name || ""),
          String(args.path || ""),
        );
        return { ok: true, result: file };
      }
      case "run_script": {
        const result = await runSkillScript(
          String(args.name || ""),
          String(args.script || ""),
          Array.isArray(args.args) ? args.args.map(String) : [],
        );
        return { ok: result.exitCode === 0, result };
      }
      default:
        return { ok: false, result: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    return {
      ok: false,
      result: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function saveRun(run: RunRecord): Promise<void> {
  await ensureRunsDir();
  await fs.writeFile(runFile(run.id), JSON.stringify(run, null, 2), "utf8");
}

export async function getRun(id: string): Promise<RunRecord | null> {
  try {
    const raw = await fs.readFile(runFile(id), "utf8");
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}

export async function listRuns(limit = 30): Promise<RunRecord[]> {
  await ensureRunsDir();
  const entries = await fs.readdir(RUNS_DIR);
  const files = entries.filter((f) => f.endsWith(".json")).sort().reverse();
  const runs: RunRecord[] = [];
  for (const file of files.slice(0, limit)) {
    try {
      const raw = await fs.readFile(path.join(RUNS_DIR, file), "utf8");
      runs.push(JSON.parse(raw) as RunRecord);
    } catch {
      // skip corrupt
    }
  }
  runs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return runs;
}

export async function runAgent(opts: {
  prompt: string;
  skillName?: string | null;
  maxSteps?: number;
}): Promise<RunRecord> {
  const maxSteps = opts.maxSteps ?? 8;
  const llm = await getLlmConfig();
  const id = randomUUID();
  const run: RunRecord = {
    id,
    skillName: opts.skillName || null,
    prompt: opts.prompt,
    status: "running",
    model: llm.model,
    createdAt: new Date().toISOString(),
    events: [],
  };

  const push = async (
    kind: TraceEvent["kind"],
    title: string,
    detail?: string,
    data?: unknown,
  ) => {
    run.events.push(event(kind, title, detail, data));
    await saveRun(run);
  };

  await push("system", "Run started", opts.prompt);

  const systemParts = [
    "You are Skill Lab Agent — a personal assistant for researching Cursor Agent Skills.",
    "You can list/load skills, read skill files, and run local scripts under a skill's scripts/ folder.",
    "Prefer loading the relevant skill first, follow its instructions, and use tools when needed.",
    "When done, give a clear final answer summarizing what you did and the outcome.",
    "This is a simulated local lab: do not claim access to Cursor IDE internals.",
  ];

  if (opts.skillName) {
    try {
      const skill = await getSkill(opts.skillName);
      systemParts.push(
        "",
        `Active skill focus: ${skill.name}`,
        `Description: ${skill.description}`,
        "You should call load_skill on this skill early unless the user asks otherwise.",
      );
      await push(
        "system",
        `Focused skill: ${skill.name}`,
        skill.description,
      );
    } catch (err) {
      await push(
        "error",
        "Failed to preload skill",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemParts.join("\n") },
    { role: "user", content: opts.prompt },
  ];

  await push("user", "User prompt", opts.prompt);

  try {
    for (let step = 0; step < maxSteps; step++) {
      await push("assistant", `Model step ${step + 1}`, "Calling DeepSeek…");

      const completion = await chatCompletion({
        messages,
        tools: TOOLS,
      });
      run.model = completion.model;

      if (completion.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: completion.content,
          tool_calls: completion.tool_calls,
        });

        if (completion.content) {
          await push("assistant", "Assistant note", completion.content);
        }

        for (const call of completion.tool_calls) {
          await push(
            "tool_call",
            call.function.name,
            call.function.arguments,
            call,
          );

          const { ok, result } = await executeTool(
            call.function.name,
            call.function.arguments,
          );

          const kind =
            call.function.name === "run_script" ? "script" : "tool_result";
          await push(
            kind,
            `${call.function.name} → ${ok ? "ok" : "error"}`,
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2).slice(0, 8000),
            result,
          );

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const finalText = completion.content || "(empty response)";
      messages.push({ role: "assistant", content: finalText });
      run.result = finalText;
      run.status = "completed";
      run.finishedAt = new Date().toISOString();
      await push("done", "Final answer", finalText);
      await saveRun(run);
      return run;
    }

    run.status = "failed";
    run.result = "Stopped: max tool steps reached without a final answer.";
    run.finishedAt = new Date().toISOString();
    await push("error", "Max steps reached", run.result);
    await saveRun(run);
    return run;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run.status = "failed";
    run.result = message;
    run.finishedAt = new Date().toISOString();
    await push("error", "Run failed", message);
    await saveRun(run);
    return run;
  }
}
