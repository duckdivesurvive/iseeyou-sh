// packages/hooks/src/user-prompt-submit.ts
// Called by the shell hook script.
// Reads .uberclaude.local from CWD, fetches full permitted context,
// and outputs it as plain text to stdout for Claude Code to inject.

import { readLocalConfig, createSupabaseClient } from './shared.js';

async function main() {
  const config = readLocalConfig(process.cwd());
  if (!config) {
    // No project configured — silently exit
    process.exit(0);
  }

  const client = createSupabaseClient();
  const projectId = config.project_id;

  // Get project name
  const { data: project } = await client
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single();

  // Get permissions
  const { data: perms } = await client
    .from('project_permissions')
    .select('category, level')
    .eq('project_id', projectId);

  const permMap: Record<string, string> = {};
  for (const p of perms || []) {
    permMap[p.category] = p.level;
  }

  // Get ancestor chain
  let ancestors: string[] = [];
  let currentId = projectId;
  for (let i = 0; i < 2; i++) {
    const { data: proj } = await client
      .from('projects')
      .select('parent_id')
      .eq('id', currentId)
      .single();
    if (!proj?.parent_id) break;
    ancestors.push(proj.parent_id);
    currentId = proj.parent_id;
  }

  // Collect model entries (own + ancestors for permitted categories)
  const modelCategories = ['codebase', 'domain', 'decisions', 'conventions'].filter(
    (cat) => permMap[cat] && permMap[cat] !== 'none'
  );

  const allProjectIds = [projectId, ...ancestors];
  const { data: ownModels } = await client
    .from('project_models')
    .select('category, key, value')
    .eq('project_id', projectId);

  let ancestorModels: any[] = [];
  if (ancestors.length > 0 && modelCategories.length > 0) {
    const { data } = await client
      .from('project_models')
      .select('category, key, value')
      .in('project_id', ancestors)
      .in('category', modelCategories);
    ancestorModels = data || [];
  }

  // Only include ancestor models in hook output — own files are already readable by Claude
  // This prevents duplicating context the AI can get by reading local files
  const allModels = ancestorModels;

  // Collect decisions (non-superseded)
  const decisionProjectIds = permMap.decisions !== 'none' ? allProjectIds : [projectId];
  const { data: decisions } = await client
    .from('decisions')
    .select('id, decision, rationale, alternatives, supersedes_id, propagate, created_at')
    .in('project_id', decisionProjectIds)
    .order('created_at', { ascending: true });

  // Include propagated child decisions
  const { data: children } = await client
    .from('projects')
    .select('id')
    .eq('parent_id', projectId);

  let propagated: any[] = [];
  if (children && children.length > 0) {
    const { data } = await client
      .from('decisions')
      .select('id, decision, rationale, alternatives, supersedes_id, propagate, created_at')
      .in('project_id', children.map((c: any) => c.id))
      .eq('propagate', true);
    propagated = data || [];
  }

  const allDecisions = [...(decisions || []), ...propagated];
  const supersededIds = new Set(allDecisions.filter((d) => d.supersedes_id).map((d) => d.supersedes_id));
  const activeDecisions = allDecisions.filter((d) => !supersededIds.has(d.id));

  // Get task state (own only)
  const { data: taskState } = await client
    .from('task_states')
    .select('in_progress, completed, blocked, next')
    .eq('project_id', projectId)
    .single();

  // Format output
  const lines: string[] = [];
  lines.push(`# Project Context: ${project?.name || 'Unknown'}`);
  lines.push('');
  lines.push('> This context is injected from the uberclaude project database. It includes knowledge from this project and its parent project(s). When answering questions about the project, check this context FIRST before searching files.');
  lines.push('');

  // Decisions and task state FIRST — they're most important for Claude to see
  if (activeDecisions.length > 0) {
    lines.push('## Decisions');
    for (const d of activeDecisions) {
      lines.push(`- **${d.decision}** — ${d.rationale}`);
    }
    lines.push('');
  }

  if (taskState) {
    lines.push('## Current Task State');
    if (taskState.in_progress?.length > 0) lines.push(`In progress: ${taskState.in_progress.join(', ')}`);
    if (taskState.blocked?.length > 0) lines.push(`Blocked: ${taskState.blocked.join(', ')}`);
    if (taskState.next?.length > 0) lines.push(`Next: ${taskState.next.join(', ')}`);
    lines.push('');
  }

  // Model entries LAST — least urgent, most verbose
  if (allModels.length > 0) {
    const byCategory: Record<string, any[]> = {};
    for (const m of allModels) {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(m);
    }

    const compact = allModels.length > 30;

    for (const [cat, entries] of Object.entries(byCategory)) {
      lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${entries.length} entries)`);
      for (const e of entries) {
        if (compact) {
          const brief = e.value.replace(/\n/g, ' ').replace(/^#+ /, '').slice(0, 80).trim();
          lines.push(`- ${e.key}: ${brief}`);
        } else {
          const summary = e.value.replace(/\n/g, ' ').slice(0, 200);
          lines.push(`- **${e.key}**: ${summary}`);
        }
      }
      lines.push('');
    }
  }

  // Output to stdout
  process.stdout.write(lines.join('\n'));
}

main().catch((err) => {
  // Silently fail — don't break Claude Code
  process.stderr.write(`uberclaude hook error: ${err.message}\n`);
  process.exit(0);
});
