// packages/cli/src/commands/init.ts
import { input, select, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getAuthenticatedClient, loadCredentials } from '../auth.js';
import { readLocalConfig, writeProjectConfig, writeLocalConfig, writeClaudeCodeMcpConfig, writeClaudeCodeHooksConfig } from '../config.js';

const ALL_CATEGORIES = ['codebase', 'domain', 'decisions', 'conventions', 'task_state'] as const;
const PERMISSION_LEVELS = ['write', 'read', 'none'] as const;

export async function initCommand(options?: { fresh?: boolean }): Promise<void> {
  console.log(chalk.bold('uberclaude init\n'));

  const client = await getAuthenticatedClient();
  const cwd = process.cwd();

  // Get current user ID for workspace ownership
  let user: any;
  try {
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) throw new Error(userError?.message || 'No user');
    user = data.user;
  } catch (err: any) {
    if (err.message?.includes('fetch') || err.message?.includes('ECONNREFUSED')) {
      console.error(chalk.red('Cannot connect to Supabase.'));
      console.error(chalk.dim('Is Supabase running? Try: iseeyou-sh setup'));
    } else {
      console.error(chalk.red('Not authenticated. Run `iseeyou-sh setup` first.'));
    }
    process.exit(1);
  }

  // Check if project already exists here
  const existingConfig = readLocalConfig(cwd);
  if (existingConfig && !options?.fresh) {
    const action = await select({
      message: 'Project already initialized. What do you want to do?',
      choices: [
        { name: 'Re-scan context files and update model', value: 'rescan' },
        { name: 'Start fresh (delete and re-create project)', value: 'fresh' },
        { name: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'cancel') return;
    if (action === 'rescan') {
      await rescanContextFiles(client, cwd, existingConfig.project_id, existingConfig.workspace_id);
      return;
    }
    // action === 'fresh': delete old project and fall through to full init
    console.log(chalk.dim('Removing old project...'));
    await client.from('task_states').delete().eq('project_id', existingConfig.project_id);
    await client.from('decisions').delete().eq('project_id', existingConfig.project_id);
    await client.from('project_models').delete().eq('project_id', existingConfig.project_id);
    await client.from('project_permissions').delete().eq('project_id', existingConfig.project_id);
    await client.from('projects').delete().eq('id', existingConfig.project_id);
  }

  // Step 1: Select or create workspace
  const { data: workspaces } = await client
    .from('workspaces')
    .select('id, name, slug');

  let workspaceId: string;
  let workspaceSlug: string;

  if (workspaces && workspaces.length > 0) {
    const choices = [
      ...workspaces.map((w: any) => ({ name: `${w.name} (${w.slug})`, value: w.id })),
      { name: chalk.green('+ Create new workspace'), value: '__new__' },
    ];

    const selected = await select({
      message: 'What workspace?',
      choices,
    });

    if (selected === '__new__') {
      const result = await createWorkspace(client, user.id);
      workspaceId = result.id;
      workspaceSlug = result.slug;
    } else {
      workspaceId = selected as string;
      workspaceSlug = workspaces.find((w: any) => w.id === selected)!.slug;
    }
  } else {
    console.log(chalk.dim('No workspaces found. Let\'s create one.'));
    const result = await createWorkspace(client, user.id);
    workspaceId = result.id;
    workspaceSlug = result.slug;
  }

  // Step 2: Project name and slug
  const projectName = await input({
    message: 'Project name:',
    default: basename(cwd),
  });

  const projectSlug = await input({
    message: 'Project slug:',
    default: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  });

  // Step 3: Parent project
  const { data: existingProjects } = await client
    .from('projects')
    .select('id, name, slug')
    .eq('workspace_id', workspaceId);

  let parentId: string | null = null;

  if (existingProjects && existingProjects.length > 0) {
    const parentChoices = [
      { name: 'None (root project)', value: '__none__' },
      ...existingProjects.map((p: any) => ({ name: `${p.name} (${p.slug})`, value: p.id })),
    ];

    const selected = await select({
      message: 'Parent project?',
      choices: parentChoices,
    });

    parentId = selected === '__none__' ? null : selected as string;
  }

  // Step 4: Permissions (if child project)
  let permissions: Record<string, string> = {};

  if (parentId) {
    console.log(chalk.dim('\nSet permissions for each context category:'));
    for (const category of ALL_CATEGORIES) {
      const level = await select({
        message: `  ${category}:`,
        choices: PERMISSION_LEVELS.map((l) => ({ name: l, value: l })),
        default: category === 'task_state' ? 'write' : 'read',
      });
      permissions[category] = level;
    }
  } else {
    // Root project: write on everything
    for (const cat of ALL_CATEGORIES) {
      permissions[cat] = 'write';
    }
  }

  // Step 5: Create project
  const { data: project, error } = await client
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: projectName,
      slug: projectSlug,
      parent_id: parentId,
      codebase_path: cwd,
    })
    .select()
    .single();

  if (error) {
    console.error(chalk.red(`Failed to create project: ${error.message}`));
    process.exit(1);
  }

  // Insert permissions
  const permRows = ALL_CATEGORIES.map((cat) => ({
    project_id: project.id,
    category: cat,
    level: permissions[cat] || 'none',
  }));

  const { error: permError } = await client
    .from('project_permissions')
    .insert(permRows);

  if (permError) {
    console.error(chalk.red(`Failed to set permissions: ${permError.message}`));
    // Rollback project
    await client.from('projects').delete().eq('id', project.id);
    process.exit(1);
  }

  // Step 6: Scan for context files
  console.log(chalk.dim('\nScanning for context files...'));

  // Find all .md files in the project (excluding node_modules, .nuxt, dist, etc.)
  const allMdFiles = findMdFiles(cwd);
  const contextFiles: string[] = [];

  if (allMdFiles.length > 0) {
    console.log(chalk.green(`Found ${allMdFiles.length} .md files in project:`));
    for (const f of allMdFiles.slice(0, 20)) {
      console.log(chalk.dim(`  - ${f}`));
    }
    if (allMdFiles.length > 20) {
      console.log(chalk.dim(`  ... and ${allMdFiles.length - 20} more`));
    }

    const includeAll = await confirm({
      message: `Include all ${allMdFiles.length} .md files as context?`,
      default: allMdFiles.length <= 15,
    });

    if (includeAll) {
      contextFiles.push(...allMdFiles);
    } else {
      const description = await input({
        message: 'Describe which files to include (e.g. "session context, architecture docs, anything in docs/"):',
      });

      if (description.trim()) {
        const keywords = description.toLowerCase().split(/[\s,]+/).filter(Boolean);
        for (const f of allMdFiles) {
          const lower = f.toLowerCase();
          if (keywords.some((kw) => lower.includes(kw))) {
            contextFiles.push(f);
          }
        }

        if (contextFiles.length === 0) {
          console.log(chalk.yellow('  No files matched. Including common context files only.'));
          for (const f of allMdFiles) {
            const lower = f.toLowerCase();
            if (lower.includes('claude') || lower.includes('readme') || lower.includes('session') || lower.includes('context') || lower.includes('architecture')) {
              contextFiles.push(f);
            }
          }
        }

        if (contextFiles.length > 0) {
          console.log(chalk.green(`Selected ${contextFiles.length} files:`));
          for (const f of contextFiles) {
            console.log(chalk.dim(`  - ${f}`));
          }
        }
      }
    }
  }

  // Also check for non-.md known files
  const extraKnown = ['.claude/settings.json', '.claude/settings.local.json'];
  for (const f of extraKnown) {
    if (existsSync(join(cwd, f)) && !contextFiles.includes(f)) {
      contextFiles.push(f);
    }
  }

  // Step 7: Read context files and create model entries
  if (contextFiles.length > 0) {
    console.log(chalk.dim('\nReading context files for model population...'));
    let modelEntries: { category: string; key: string; value: string }[] = [];

    for (const file of contextFiles) {
      const content = readFileSync(join(cwd, file), 'utf-8');
      // Create a model entry summarizing each file
      const category = file.toLowerCase().includes('readme') ? 'codebase'
        : file.toLowerCase().includes('claude') ? 'conventions'
        : file.toLowerCase().includes('session') ? 'domain'
        : 'codebase';

      modelEntries.push({
        category,
        key: file,
        value: content.slice(0, 2000), // Truncate large files
      });
    }

    if (modelEntries.length > 0) {
      const { error: modelError } = await client
        .from('project_models')
        .insert(
          modelEntries.map((e) => ({
            project_id: project.id,
            ...e,
          }))
        );

      if (modelError) {
        console.log(chalk.yellow(`Warning: Failed to populate model: ${modelError.message}`));
      } else {
        console.log(chalk.green(`Populated ${modelEntries.length} model entries from context files.`));
      }
    }
  }

  // Step 7b: Seed task state from TODO.md if it exists
  await seedTaskStateFromTodo(client, cwd, project.id);

  // Step 8: Write config files
  writeProjectConfig(cwd, { workspace: workspaceSlug, project: projectSlug });
  writeLocalConfig(cwd, { project_id: project.id, workspace_id: workspaceId });

  // Step 8b: Add iseeyou.sh instructions to CLAUDE.md
  appendClaudeMdInstructions(cwd);

  // Step 9: Wire Claude Code (MCP server + hooks)
  const creds = loadCredentials();
  const supabaseUrl = process.env.SUPABASE_URL || creds?.supabase_url || 'http://127.0.0.1:54351';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || creds?.supabase_service_role_key || '';

  if (serviceRoleKey) {
    const mcpOk = writeClaudeCodeMcpConfig(cwd, supabaseUrl, serviceRoleKey);
    const hooksOk = writeClaudeCodeHooksConfig(cwd, supabaseUrl, serviceRoleKey);
    if (mcpOk && hooksOk) {
      console.log(chalk.green(`\n✓ Claude Code wired`));
      console.log(chalk.dim(`  .mcp.json — MCP server registered`));
      console.log(chalk.dim(`  .claude/settings.local.json — hooks configured`));
    } else {
      console.log(chalk.yellow(`\n⚠ Could not find iseeyou.sh monorepo (needed for MCP server + hooks)`));
      console.log(chalk.dim(`  Run: npx tsx scripts/local-setup.ts from the cloned repo to save the path`));
      console.log(chalk.dim(`  Or set ISEEYOU_ROOT=/path/to/iseeyou-sh`));
    }
  } else {
    console.log(chalk.yellow(`\n⚠ No service role key found — skipping Claude Code wiring`));
    console.log(chalk.dim(`  Run npx tsx scripts/local-setup.ts from the cloned repo first`));
  }

  console.log(chalk.green(`\n✓ Project "${projectName}" created in workspace "${workspaceSlug}"`));
  console.log(chalk.dim(`  .uberclaude and .uberclaude.local written`));

  if (parentId) {
    const permStr = Object.entries(permissions).map(([k, v]) => `${k}:${v}`).join(', ');
    console.log(chalk.dim(`  Permissions: ${permStr}`));
  }

  console.log(chalk.dim(`\n  Restart Claude Code to activate.`));
}

async function seedTaskStateFromTodo(client: any, cwd: string, projectId: string): Promise<void> {
  // Look for TODO.md, TODO.txt, or todo.md
  const todoNames = ['TODO.md', 'TODO.txt', 'todo.md', 'TODOS.md'];
  let todoPath: string | null = null;

  const searchDirs = [cwd, join(cwd, 'docs'), join(cwd, '.claude')];
  for (const dir of searchDirs) {
    for (const name of todoNames) {
      const p = join(dir, name);
      if (existsSync(p)) {
        todoPath = p;
        break;
      }
    }
    if (todoPath) break;
  }

  if (!todoPath) return;

  console.log(chalk.dim(`\nFound ${basename(todoPath)} — parsing task state...`));
  const content = readFileSync(todoPath, 'utf-8');
  const lines = content.split('\n');

  const completed: string[] = [];
  const inProgress: string[] = [];
  const next: string[] = [];
  const blocked: string[] = [];

  let currentSection = 'next'; // default section

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headings
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].toLowerCase();
      if (heading.includes('complete') || heading.includes('done') || heading.includes('finished')) {
        currentSection = 'completed';
      } else if (heading.includes('progress') || heading.includes('current') || heading.includes('doing') || heading.includes('wip')) {
        currentSection = 'in_progress';
      } else if (heading.includes('block') || heading.includes('stuck') || heading.includes('waiting')) {
        currentSection = 'blocked';
      } else if (heading.includes('next') || heading.includes('todo') || heading.includes('upcoming') || heading.includes('planned')) {
        currentSection = 'next';
      }
      continue;
    }

    // Parse checkbox items: - [x] done, - [ ] not done
    const checkboxMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
    if (checkboxMatch) {
      const isDone = checkboxMatch[1] !== ' ';
      const text = checkboxMatch[2].trim();
      if (isDone) {
        completed.push(text);
      } else if (currentSection === 'blocked') {
        blocked.push(text);
      } else if (currentSection === 'in_progress') {
        inProgress.push(text);
      } else {
        next.push(text);
      }
      continue;
    }

    // Parse plain list items: - item or * item
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      const text = listMatch[1].trim();
      if (currentSection === 'completed') {
        completed.push(text);
      } else if (currentSection === 'in_progress') {
        inProgress.push(text);
      } else if (currentSection === 'blocked') {
        blocked.push(text);
      } else {
        next.push(text);
      }
    }
  }

  const total = completed.length + inProgress.length + next.length + blocked.length;
  if (total === 0) return;

  const { error } = await client.from('task_states').upsert({
    project_id: projectId,
    completed,
    in_progress: inProgress,
    blocked,
    next,
  }, { onConflict: 'project_id' });

  if (error) {
    console.log(chalk.yellow(`  Warning: Failed to seed task state: ${error.message}`));
  } else {
    console.log(chalk.green(`  Task state seeded from ${basename(todoPath)}:`));
    if (inProgress.length) console.log(chalk.cyan(`    In progress: ${inProgress.length}`));
    if (blocked.length) console.log(chalk.red(`    Blocked: ${blocked.length}`));
    if (next.length) console.log(chalk.dim(`    Next: ${next.length}`));
    if (completed.length) console.log(chalk.green(`    Completed: ${completed.length}`));
  }
}

const ISEEYOU_CLAUDE_MD = `
# iseeyou.sh — Project Context

This project is connected to iseeyou.sh for persistent context management.

## Decision Logging
When you make, agree on, or discover a significant decision during this session, log it using the \`uc_log_decision\` MCP tool. This includes:
- Architectural choices ("we chose X over Y because Z")
- Product direction changes ("renamed feature X to Y")
- Convention decisions ("all API routes use snake_case")
- Strategy decisions ("targeting SMEs first, enterprise later")

Call \`uc_log_decision\` with the decision, rationale, and alternatives considered. Set \`propagate: true\` if child projects should see it.

After every 5-10 exchanges, or when a brainstorming topic wraps up, ask the user: "Want me to log the decisions we've made so far?" Then call uc_log_decision for each one they confirm.

## Task State
When you complete meaningful work or the task focus shifts, update the task state using \`uc_update_state\`.

## Project Knowledge
When you learn something significant about the project (domain entities, conventions, architecture), store it using \`uc_update_model\`.
`.trim();

function appendClaudeMdInstructions(dir: string): void {
  const claudeMdPath = join(dir, 'CLAUDE.md');
  const marker = '# iseeyou.sh';

  try {
    if (existsSync(claudeMdPath)) {
      const existing = readFileSync(claudeMdPath, 'utf-8');
      if (existing.includes(marker)) return; // Already has instructions
      writeFileSync(claudeMdPath, existing + '\n\n' + ISEEYOU_CLAUDE_MD + '\n');
    } else {
      writeFileSync(claudeMdPath, ISEEYOU_CLAUDE_MD + '\n');
    }
    console.log(chalk.green(`  CLAUDE.md — iseeyou.sh instructions added`));
  } catch {
    // Skip if can't write
  }
}

const IGNORE_DIRS = new Set([
  'node_modules', '.nuxt', '.output', 'dist', '.git', '.next', '.cache',
  'vendor', 'build', 'coverage', '.turbo', '.vercel',
]);

function findMdFiles(rootDir: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(join(rootDir, prefix), { withFileTypes: true });
    for (const entry of entries) {
      const relPath = prefix ? join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.pnpm')) {
          results.push(...findMdFiles(rootDir, relPath));
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
        results.push(relPath);
      }
    }
  } catch {
    // Permission denied or other error — skip
  }
  return results;
}

async function rescanContextFiles(client: any, cwd: string, projectId: string, workspaceId: string): Promise<void> {
  const allMdFiles = findMdFiles(cwd);

  if (allMdFiles.length === 0) {
    console.log(chalk.dim('No .md files found.'));
    return;
  }

  console.log(chalk.green(`Found ${allMdFiles.length} .md files:`));
  for (const f of allMdFiles.slice(0, 20)) {
    console.log(chalk.dim(`  - ${f}`));
  }
  if (allMdFiles.length > 20) {
    console.log(chalk.dim(`  ... and ${allMdFiles.length - 20} more`));
  }

  const contextFiles: string[] = [];

  const includeAll = await confirm({
    message: `Include all ${allMdFiles.length} files as context?`,
    default: allMdFiles.length <= 15,
  });

  if (includeAll) {
    contextFiles.push(...allMdFiles);
  } else {
    const description = await input({
      message: 'Describe which files to include (e.g. "session context, architecture docs, anything in docs/"):',
    });

    if (description.trim()) {
      const keywords = description.toLowerCase().split(/[\s,]+/).filter(Boolean);
      for (const f of allMdFiles) {
        const lower = f.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw))) {
          contextFiles.push(f);
        }
      }
    }

    if (contextFiles.length === 0) {
      console.log(chalk.yellow('  No matches. Including common context files.'));
      for (const f of allMdFiles) {
        const lower = f.toLowerCase();
        if (lower.includes('claude') || lower.includes('readme') || lower.includes('session') || lower.includes('context') || lower.includes('architecture')) {
          contextFiles.push(f);
        }
      }
    }

    console.log(chalk.green(`Selected ${contextFiles.length} files`));
  }

  if (contextFiles.length === 0) return;

  console.log(chalk.dim('\nUpdating project model...'));
  let count = 0;
  for (const file of contextFiles) {
    const content = readFileSync(join(cwd, file), 'utf-8');
    const category = file.toLowerCase().includes('readme') ? 'codebase'
      : file.toLowerCase().includes('claude') ? 'conventions'
      : file.toLowerCase().includes('session') ? 'domain'
      : 'codebase';

    const { error } = await client
      .from('project_models')
      .upsert(
        { project_id: projectId, category, key: file, value: content.slice(0, 2000) },
        { onConflict: 'project_id,category,key' }
      );

    if (!error) count++;
  }

  console.log(chalk.green(`Updated ${count} model entries.`));

  // Re-wire Claude Code config
  const creds = loadCredentials();
  const supabaseUrl = process.env.SUPABASE_URL || creds?.supabase_url || 'http://127.0.0.1:54351';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || creds?.supabase_service_role_key || '';

  if (serviceRoleKey) {
    const ok = writeClaudeCodeMcpConfig(cwd, supabaseUrl, serviceRoleKey) && writeClaudeCodeHooksConfig(cwd, supabaseUrl, serviceRoleKey);
    if (ok) console.log(chalk.green(`✓ Claude Code config updated`));
  }

  // Also re-seed task state from TODO.md
  await seedTaskStateFromTodo(client, cwd, projectId);

  console.log(chalk.dim('\nRestart Claude Code to pick up changes.'));
}

async function createWorkspace(client: any, ownerId: string): Promise<{ id: string; slug: string }> {
  const name = await input({ message: 'Workspace name:' });
  const slug = await input({
    message: 'Workspace slug:',
    default: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  });

  const { data, error } = await client
    .from('workspaces')
    .insert({ name, slug, owner_id: ownerId })
    .select()
    .single();

  if (error) {
    console.error(chalk.red(`Failed to create workspace: ${error.message}`));
    process.exit(1);
  }

  return { id: data.id, slug: data.slug };
}
