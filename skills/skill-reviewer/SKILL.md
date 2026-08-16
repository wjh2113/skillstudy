---
name: skill-reviewer
description: >-
  Reviews a Cursor skill for structure, description quality, and progressive
  disclosure. Use when the user asks to review, audit, or improve a SKILL.md.
disable-model-invocation: true
---

# Skill Reviewer

## Checklist

Evaluate the loaded skill files against:

1. **Frontmatter**: `name` (kebab-case ≤64), `description` (WHAT + WHEN, third person)
2. **Length**: SKILL.md ideally under 500 lines
3. **Progressive disclosure**: heavy detail moved to reference files
4. **Paths**: use POSIX-style paths (`scripts/foo.py`), not Windows backslashes
5. **Scripts**: if scripts exist, instructions should say when to run them

## Workflow

1. `load_skill` on the target skill (or `list_skills` first)
2. `read_skill_file` on `SKILL.md` and any linked docs
3. Produce a short review with Critical / Suggestion / Nice-to-have
