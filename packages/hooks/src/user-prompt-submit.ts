// packages/hooks/src/user-prompt-submit.ts
// Injects a minimal context stub before every prompt.
// Full context is available via MCP tools (uc_get_context, uc_get_project_model, etc.)

import { readLocalConfig, createSupabaseClient } from './shared.js';

const MAX_RECENT_DECISIONS = 3;

async function main() {
  const config = readLocalConfig(process.cwd());
  if (!config) {
    process.exit(0);
  }

  const client = createSupabaseClient();
  const projectId = config.project_id;

  // Fetch project name, recent decisions, and task state in parallel
  const [projectResult, decisionsResult, taskStateResult, childrenResult] = await Promise.all([
    client.from('projects').select('name, parent_id').eq('id', projectId).single(),
    client.from('decisions')
      .select('id, decision, supersedes_id, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20),
    client.from('task_states')
      .select('in_progress, blocked, next')
      .eq('project_id', projectId)
      .single(),
    client.from('projects').select('id').eq('parent_id', projectId),
  ]);

  const project = projectResult.data;
  const ownDecisions = decisionsResult.data || [];

  // Also get parent decisions and propagated child decisions (limited)
  let parentDecisions: any[] = [];
  let propagatedDecisions: any[] = [];

  if (project?.parent_id) {
    const { data } = await client.from('decisions')
      .select('id, decision, supersedes_id, created_at')
      .eq('project_id', project.parent_id)
      .order('created_at', { ascending: false })
      .limit(10);
    parentDecisions = data || [];
  }

  const childIds = (childrenResult.data || []).map((c: any) => c.id);
  if (childIds.length > 0) {
    const { data } = await client.from('decisions')
      .select('id, decision, supersedes_id, created_at')
      .in('project_id', childIds)
      .eq('propagate', true)
      .order('created_at', { ascending: false })
      .limit(5);
    propagatedDecisions = data || [];
  }

  // Merge, filter superseded, take most recent
  const allDecisions = [...ownDecisions, ...parentDecisions, ...propagatedDecisions];
  const supersededIds = new Set(allDecisions.filter(d => d.supersedes_id).map(d => d.supersedes_id));
  const activeDecisions = allDecisions
    .filter(d => !supersededIds.has(d.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_RECENT_DECISIONS);

  const taskState = taskStateResult.data;

  // Count totals for the summary line
  const totalDecisions = allDecisions.filter(d => !supersededIds.has(d.id)).length;

  // Build minimal stub
  const lines: string[] = [];
  lines.push(`# Project Context: ${project?.name || 'Unknown'}`);
  lines.push('');
  lines.push('> This is a summary. Use MCP tools for full context: `uc_get_context`, `uc_get_project_model`, `uc_log_decision`, `uc_update_state`, `uc_update_model`. When the user asks about project state, decisions, or context — call the MCP tools, don\'t rely only on this summary.');
  lines.push('');

  if (activeDecisions.length > 0) {
    lines.push(`## Recent Decisions (${activeDecisions.length} of ${totalDecisions} total)`);
    for (const d of activeDecisions) {
      lines.push(`- ${d.decision}`);
    }
    if (totalDecisions > MAX_RECENT_DECISIONS) {
      lines.push(`- _...${totalDecisions - MAX_RECENT_DECISIONS} more — use \`uc_get_context\` to see all_`);
    }
    lines.push('');
  }

  if (taskState) {
    const parts: string[] = [];
    if (taskState.in_progress?.length > 0) parts.push(`In progress: ${taskState.in_progress.join(', ')}`);
    if (taskState.blocked?.length > 0) parts.push(`Blocked: ${taskState.blocked.join(', ')}`);
    if (taskState.next?.length > 0) parts.push(`Next: ${taskState.next.slice(0, 3).join(', ')}${taskState.next.length > 3 ? ` (+${taskState.next.length - 3} more)` : ''}`);
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
