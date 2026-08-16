# Skill Lab

个人用的 Skill 研究台：管理 Cursor 风格 skill，用 DeepSeek 模拟 agent 执行，并查看工具调用轨迹。

## 能力

- **加载** — 从本机 `~/.agents/skills`、`~/.cursor/skills`、`~/.codex/skills`、`~/.claude/skills` 等目录导入
- **创建** — 按规范脚手架新 skill（可选示例脚本）
- **下载** — 从 GitHub raw / `SKILL.md` URL 拉取
- **浏览** — 文件树 + 内容预览
- **运行** — DeepSeek tool-calling；本地执行 `scripts/` 下的 `.py` / `.js` / `.ps1` / `.sh`；全程写入 `runs/`

## 启动

在网页「大模型配置」填写 API Key，或复制环境变量：

```bash
copy .env.example .env.local
```

在 `.env.local` 填入 [DeepSeek API Key](https://platform.deepseek.com/)。

2. 安装并启动：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 目录

```
skills/          # 本地 skill 仓库
runs/            # 执行 trace（JSON）
src/lib/         # skill 管理 + DeepSeek agent + 脚本执行
src/app/         # Web UI + API
```

## Agent 工具

| 工具 | 作用 |
|------|------|
| `list_skills` | 列出本地 skill |
| `load_skill` | 加载元数据 / 正文 / 文件树 |
| `read_skill_file` | 读 skill 内文件 |
| `run_script` | 执行 `skills/<name>/scripts/<file>` |
