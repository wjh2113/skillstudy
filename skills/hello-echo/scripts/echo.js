#!/usr/bin/env node
const args = process.argv.slice(2);
const payload = {
  skill: process.env.SKILL_NAME || "hello-echo",
  args,
  message: args.length ? `echo: ${args.join(" ")}` : "echo: (no args)",
  at: new Date().toISOString(),
};
console.log(JSON.stringify(payload, null, 2));
