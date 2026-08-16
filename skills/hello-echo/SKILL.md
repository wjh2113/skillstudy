---
name: hello-echo
description: >-
  Demo skill for Skill Lab. Echoes arguments via a local Node script.
  Use when testing skill loading, script execution, or tracing tool calls.
disable-model-invocation: true
---

# Hello Echo

## When to use

Use this skill to verify that Skill Lab can load a skill and run a local script.

## Workflow

1. Read this file with `load_skill`.
2. Optionally inspect `scripts/echo.js` with `read_skill_file`.
3. Run the script:

```bash
node scripts/echo.js your message here
```

Or via the agent tool:

- `run_script` with `name: hello-echo`, `script: echo.js`, `args: ["hello", "skill"]`

## Expected result

Stdout should contain a JSON line with the received arguments and a greeting.
