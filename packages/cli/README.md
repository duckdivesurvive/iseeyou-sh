# iseeyou-sh

**Your AI finally understands your project.**

Persistent, hierarchical context for AI coding assistants. Parent projects share knowledge with children. Permissions control who sees what. Every session starts with understanding.

## Install

```bash
npm install -g iseeyou-sh
iseeyou-sh setup    # one-time: database, credentials, MCP registration
iseeyou-sh init     # per project: workspace, parent, permissions, context scan
```

## What it does

You work across related projects — a main product, an admin panel, a marketing site, docs. Your AI treats them as islands. iseeyou.sh connects them.

```
Startup
├── Main Product        ← source of truth (write all)
├── Admin Panel         ← inherits product knowledge (write all)
├── Marketing           ← reads product context (read only)
└── Content             ← inherits from marketing (read only)
```

Run `iseeyou-sh init` in each project directory. Pick a parent. Set permissions. The tool scans your existing `.md` files and builds a project model.

iseeyou.sh is an **MCP server** that registers globally with Claude Code via `claude mcp add --scope user`. Once registered, Claude has 8 tools for reading and writing project knowledge — available in every session, every project. Context is also injected automatically before every prompt via hooks. No re-explaining. No context loss between sessions.

## Commands

| Command | Description |
|---------|-------------|
| `iseeyou-sh setup` | One-time setup: database, user, credentials, MCP registration |
| `iseeyou-sh init` | Set up a project (workspace, parent, permissions, context scan) |
| `iseeyou-sh register` | Register MCP server globally with Claude Code |
| `iseeyou-sh backup` | Dump all data to supabase/seed.sql (auto-restores on start) |
| `iseeyou-sh login` | Authenticate with Supabase |
| `iseeyou-sh link` | Link to an existing project from `.uberclaude` file |
| `iseeyou-sh tree` | Print project hierarchy with permissions |
| `iseeyou-sh status` | Show task state + permissions |
| `iseeyou-sh log` | Browse the decision ledger |
| `iseeyou-sh permissions` | View or update permissions |
| `iseeyou-sh model` | Browse or add model entries |

## How it works

1. **Setup** starts local Supabase, runs migrations, and registers the MCP server globally with Claude Code
2. **Init** scans your project for `.md` files, `TODO.md`, and existing context
3. **Supabase** stores the project model, decisions, permissions, and task state
4. **Claude Code hooks** inject context before every prompt
5. **MCP server** (registered globally) provides 8 tools for Claude to read/write project knowledge
6. **Backup** dumps data to `supabase/seed.sql` so it auto-restores if the database resets
7. **Permissions** control what child projects can see from parents

## Requirements

- Node.js 20+
- Local or hosted Supabase instance
- Claude Code (for hooks + MCP integration)

## Links

- [GitHub](https://github.com/duckdivesurvive/iseeyou-sh)
- [Website](https://iseeyou.sh)
- [Full documentation](https://github.com/duckdivesurvive/iseeyou-sh#readme)

## License

MIT
