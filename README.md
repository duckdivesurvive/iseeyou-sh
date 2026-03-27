# iseeyou.sh

**Your AI finally understands your project.**

Persistent, hierarchical context for AI coding assistants. Parent projects share knowledge with children. Permissions control who sees what. Every session starts with understanding.

## The Problem

You work across multiple related projects:

```
Startup
├── Main product             ← source of truth
├── Admin panel              ← needs product's API/domain
├── Marketing site           ← needs to understand the product
├── Docs project             ← same as marketing
└── Mobile app               ← needs API contracts
```

Every time you start Claude Code in the admin panel, it has no idea what the main product does. You re-explain everything. Every session. Every project.

## The Solution

iseeyou.sh gives each project a persistent model (domain, codebase, conventions, decisions, task state) with parent/child inheritance and permission control.

- **Marketing** can *read* the main product's domain and features but can't *write* to the codebase
- **A content project** inherits its parent's knowledge automatically

iseeyou.sh is an **MCP server** that registers globally with Claude Code. Once set up, Claude has access to 8 tools for reading and writing project knowledge — in every session, in every project. Context is also injected automatically before every prompt via hooks. No manual searching. No re-explaining.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)

### Setup (one-time)

```bash
npm install -g iseeyou-sh
iseeyou-sh setup
```

This handles everything: starts a local Supabase instance, runs database migrations, creates a user, saves credentials, and registers the MCP server globally with Claude Code.

### Initialize a project

```bash
cd ~/your-project
iseeyou-sh init
```

The `init` command:
1. Creates/selects a workspace
2. Names the project, picks a parent, sets permissions
3. Scans all `.md` files for project context
4. Parses `TODO.md` into task state
5. Configures Claude Code hooks for context injection
6. Adds decision logging instructions to CLAUDE.md

The MCP server is registered globally during `setup`, so it's available in every project without per-project `.mcp.json` files.

Restart Claude Code and it just works. Repeat for each project.

## Architecture

iseeyou.sh is primarily an **MCP (Model Context Protocol) server** — registered once globally via `claude mcp add --scope user`. This means the tools are available in every Claude Code session without any per-project configuration. Hooks provide supplementary automatic context injection.

```
packages/
├── mcp/              # MCP server (8 tools, stdio transport) — the core
├── cli/              # CLI (setup, init, register, backup, etc.)
└── hooks/            # Claude Code hooks (auto context injection)
app/                  # Nuxt 4 dashboard (read-only)
supabase/
└── migrations/       # 11 SQL migrations
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `uc_create_project` | Create project with auto-permission seeding |
| `uc_get_context` | Get full permitted context (own + parent chain) |
| `uc_log_decision` | Log architectural decisions (permission-gated) |
| `uc_update_state` | Update task state (permission-gated) |
| `uc_get_project_model` | Get project's own model entries |
| `uc_list_projects` | List workspace project tree |
| `uc_set_permissions` | Update permissions with cascade |
| `uc_update_model` | Upsert model entries (permission-gated) |

### Permission Model

Each project has permissions per context category:

| Category | Description |
|----------|-------------|
| codebase | Source files, component map, stack details |
| domain | Product entities, features, user personas |
| decisions | The decision ledger |
| conventions | Naming, patterns, code style |
| task_state | Current work state |

Levels: **write** (full access), **read** (can see, can't modify), **none** (excluded)

A child project cannot have more access than its parent. Enforced at both app and database level.

### How Claude Gets Context

There are two paths — both work together:

**1. MCP tools (on demand):** Claude can call `uc_get_context`, `uc_get_project_model`, etc. at any time. These tools are always available because the MCP server is registered globally.

**2. Hook injection (automatic):** The `UserPromptSubmit` hook fires before every prompt:
1. Reads `.uberclaude.local` to find the active project
2. Walks up the parent chain (max 3 levels)
3. Collects permitted model entries + decisions + task state
4. Injects as plain text before your prompt

Between the two, Claude always has project context — automatically on every prompt, and on demand via tools.

## CLI Commands

| Command | Description |
|---------|-------------|
| `iseeyou-sh setup` | One-time setup: database, user, credentials, MCP registration |
| `iseeyou-sh init` | Interactive project setup + context scanning |
| `iseeyou-sh register` | Register MCP server globally with Claude Code |
| `iseeyou-sh backup` | Dump all data to supabase/seed.sql (auto-restores on start) |
| `iseeyou-sh login` | Authenticate via email/password |
| `iseeyou-sh link` | Link existing `.uberclaude` to UUIDs |
| `iseeyou-sh tree` | Print project hierarchy |
| `iseeyou-sh status` | Show task state + permissions |
| `iseeyou-sh log` | Browse decision ledger |
| `iseeyou-sh permissions` | View/update permissions |
| `iseeyou-sh model` | Browse/add model entries |

## Dashboard

Read-only Nuxt 4 dashboard with Shuriken UI:

- Workspace overview with project tree
- Project detail with tabs: Model, Decisions, Task State, Permissions
- Multiple workspace support

```bash
cd app && pnpm dev
```

## Tech Stack

- **MCP Server**: Node.js + @modelcontextprotocol/sdk (stdio)
- **CLI**: Node.js + Commander + Inquirer
- **Dashboard**: Nuxt 4 + Tailwind CSS 4 + Shuriken UI
- **Database**: Supabase (PostgreSQL)
- **Monorepo**: pnpm workspaces

## Links

- [Website](https://iseeyou.sh)
- [npm](https://www.npmjs.com/package/iseeyou-sh)

## License

MIT
