// packages/hooks/src/pre-compact.ts
// Fires before context compaction. Injects a reminder of project identity
// and how to recover full context via MCP tools.

import { readLocalConfig, createSupabaseClient } from './shared.js';

async function main() {
  const config = readLocalConfig(process.cwd());
  if (!config) {
    process.exit(0);
  }

  const client = createSupabaseClient();
  const projectId = config.project_id;

  const { data: project } = await client
    .from('projects')
    .select('name, slug, parent_id')
    .eq('id', projectId)
    .single();

  const { data: taskState } = await client
    .from('task_states')
    .select('in_progress, blocked, next')
    .eq('project_id', projectId)
    .single();

  const lines: string[] = [];
  lines.push(`# Project: ${project?.name || 'Unknown'} (${project?.slug || ''})`);
  lines.push('');
  lines.push('> Context was compacted. Use MCP tools to recover full project knowledge:');
  lines.push('> - `uc_get_context` — full context (decisions, model, task state, parent chain)');
  lines.push('> - `uc_get_project_model` — project model entries by category');
  lines.push('> - `uc_log_decision` / `uc_update_state` / `uc_update_model` — write tools');
  lines.push('');

  if (taskState) {
    const parts: string[] = [];
    if (taskState.in_progress?.length > 0) parts.push(`In progress: ${taskState.in_progress.join(', ')}`);
    if (taskState.blocked?.length > 0) parts.push(`Blocked: ${taskState.blocked.join(', ')}`);
    if (taskState.next?.length > 0) parts.push(`Next: ${taskState.next.slice(0, 3).join(', ')}`);
    if (parts.length > 0) {
      lines.push('## Task State');
      lines.push(parts.join(' | '));
      lines.push('');
    }
  }

  process.stdout.write(lines.join('\n'));
}

main().catch((err) => {
  process.stderr.write(`iseeyou hook error: ${err.message}\n`);
  process.exit(0);
});
