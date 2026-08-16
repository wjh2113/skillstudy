export interface SkillMeta {
  name: string;
  description: string;
  disableModelInvocation?: boolean;
  [key: string]: unknown;
}

export interface SkillSummary {
  name: string;
  description: string;
  path: string;
  hasScripts: boolean;
  fileCount: number;
  updatedAt: string;
}

export interface SkillFileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: SkillFileNode[];
}

export interface SkillDetail extends SkillSummary {
  meta: SkillMeta;
  body: string;
  tree: SkillFileNode[];
}

export type TraceKind =
  | "system"
  | "user"
  | "assistant"
  | "tool_call"
  | "tool_result"
  | "script"
  | "error"
  | "done";

export interface TraceEvent {
  id: string;
  at: string;
  kind: TraceKind;
  title: string;
  detail?: string;
  data?: unknown;
}

export interface RunRecord {
  id: string;
  skillName: string | null;
  prompt: string;
  status: "running" | "completed" | "failed";
  model: string;
  createdAt: string;
  finishedAt?: string;
  result?: string;
  events: TraceEvent[];
}

export interface CreateSkillInput {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
  withScripts?: boolean;
}

export interface DownloadSkillInput {
  url: string;
  name?: string;
}

export type LlmProvider = "deepseek" | "openai-compatible";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface LlmConfigPublic {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  temperature: number;
  hasApiKey: boolean;
  apiKeyMasked: string;
  source: "file" | "env" | "default";
}

export interface ExternalSkillSource {
  id: string;
  label: string;
  root: string;
  exists: boolean;
}

export interface ExternalSkillItem {
  name: string;
  description: string;
  sourceId: string;
  sourceLabel: string;
  path: string;
  alreadyLoaded: boolean;
}
