// packages/hooks/src/pre-compact.ts
// Called by the shell hook script.
// Reads .uberclaude.local, fetches the full project model,
// and outputs it as a snapshot for Claude Code to retain after compaction.

import { readLocalConfig, createSupabaseClient } from './shared.js';

async function main() {
  const config = readLocalConfig(process.cwd());
  if (!config) {
    process.exit(0);
  }

  const client = createSupabaseClient();
  const projectId = config.project_id;

  // Get project info
  const { data: project } = await client
    .from('projects')
    .select('name, slug')
    .eq('id', projectId)
    .single();

  // Get all model entries for this project
  const { data: models } = await client
    .from('project_models')
    .select('category, key, value')
    .eq('project_id', projectId)
    .order('category')
    .order('key');

  // Get permissions
  const { data: perms } = await client
    .from('project_permissions')
    .select('category, level')
    .eq('project_id', projectId);

  // Get task state
  const { data: taskState } = await client
    .from('task_states')
    .select('in_progress, completed, blocked, next')
    .eq('project_id', projectId)
    .single();

  // Format snapshot
  const lines: string[] = [];
  lines.push(`# Project Snapshot: ${project?.name || 'Unknown'} (${project?.slug || ''})`);
  lines.push('');
  lines.push('> This snapshot was generated before context compaction to preserve project awareness.');
  lines.push('');

  if (perms && perms.length > 0) {
    lines.push('## Permissions');
    for (const p of perms) {
      lines.push(`- ${p.category}: ${p.level}`);
    }
    lines.push('');
  }

  if (models && models.length > 0) {
    const byCategory: Record<string, any[]> = {};
    for (const m of models) {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(m);
    }
    for (const [cat, entries] of Object.entries(byCategory)) {
      lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
      for (const e of entries) {
        lines.push(`- **${e.key}**: ${e.value}`);
      }
      lines.push('');
    }
  }

  if (taskState) {
    lines.push('## Task State');
    if (taskState.in_progress?.length > 0) lines.push(`In progress: ${taskState.in_progress.join(', ')}`);
    if (taskState.blocked?.length > 0) lines.push(`Blocked: ${taskState.blocked.join(', ')}`);
    if (taskState.completed?.length > 0) lines.push(`Completed: ${taskState.completed.join(', ')}`);
    if (taskState.next?.length > 0) lines.push(`Next: ${taskState.next.join(', ')}`);
    lines.push('');
  }

  process.stdout.write(lines.join('\n'));
}

main().catch((err) => {
  process.stderr.write(`uberclaude hook error: ${err.message}\n`);
  process.exit(0);
});
