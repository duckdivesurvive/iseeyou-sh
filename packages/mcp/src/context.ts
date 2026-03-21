import type { SupabaseClient } from '@supabase/supabase-js';
import { getProjectPermissions, getAncestorChain, type PermissionMap } from './permissions.js';

interface ModelEntry {
  project_id: string;
  category: string;
  key: string;
  value: string;
}

interface Decision {
  id: string;
  project_id: string;
  decision: string;
  rationale: string;
  alternatives: string | null;
  supersedes_id: string | null;
  propagate: boolean;
  git_ref: string | null;
  created_at: string;
}

interface TaskState {
  in_progress: string[];
  completed: string[];
  blocked: string[];
  next: string[];
}

export interface ProjectContext {
  model: ModelEntry[];
  decisions: Decision[];
  taskState: TaskState | null;
}

const MODEL_CATEGORIES = ['codebase', 'domain', 'decisions', 'conventions'] as const;

export async function assembleContext(
  client: SupabaseClient,
  projectId: string
): Promise<ProjectContext> {
  const myPerms = await getProjectPermissions(client, projectId);
  const ancestors = await getAncestorChain(client, projectId);

  const projectIdsForModels: string[] = [projectId];
  const projectIdsForDecisions: string[] = [projectId];

  for (const ancestorId of ancestors) {
    if (myPerms.codebase !== 'none' || myPerms.domain !== 'none' || myPerms.conventions !== 'none') {
      projectIdsForModels.push(ancestorId);
    }
    if (myPerms.decisions !== 'none') {
      projectIdsForDecisions.push(ancestorId);
    }
  }

  const { data: childProjects } = await client
    .from('projects')
    .select('id')
    .eq('parent_id', projectId);

  const childIds = (childProjects || []).map((p: any) => p.id);

  const permittedModelCategories = MODEL_CATEGORIES.filter(
    (cat) => myPerms[cat] !== 'none'
  );

  let model: ModelEntry[] = [];
  if (projectIdsForModels.length > 0 && permittedModelCategories.length > 0) {
    const { data: ownModels } = await client
      .from('project_models')
      .select('project_id, category, key, value')
      .eq('project_id', projectId);

    let ancestorModels: any[] = [];
    if (ancestors.length > 0) {
      const { data } = await client
        .from('project_models')
        .select('project_id, category, key, value')
        .in('project_id', ancestors)
        .in('category', permittedModelCategories);
      ancestorModels = data || [];
    }

    model = [...(ownModels || []), ...ancestorModels];
  }

  const { data: allDecisions } = await client
    .from('decisions')
    .select('id, project_id, decision, rationale, alternatives, supersedes_id, propagate, git_ref, created_at')
    .in('project_id', projectIdsForDecisions)
    .order('created_at', { ascending: true });

  let propagatedDecisions: Decision[] = [];
  if (childIds.length > 0) {
    const { data } = await client
      .from('decisions')
      .select('id, project_id, decision, rationale, alternatives, supersedes_id, propagate, git_ref, created_at')
      .in('project_id', childIds)
      .eq('propagate', true);
    propagatedDecisions = (data || []) as Decision[];
  }

  const combinedDecisions = [...(allDecisions || []), ...propagatedDecisions] as Decision[];

  const supersededIds = new Set(
    combinedDecisions
      .filter((d) => d.supersedes_id)
      .map((d) => d.supersedes_id!)
  );
  const decisions = combinedDecisions.filter((d) => !supersededIds.has(d.id));

  const { data: taskStateData } = await client
    .from('task_states')
    .select('in_progress, completed, blocked, next')
    .eq('project_id', projectId)
    .single();

  const taskState = taskStateData as TaskState | null;

  return { model, decisions, taskState };
}

export function formatContextAsText(ctx: ProjectContext, projectName?: string): string {
  const lines: string[] = [];

  if (projectName) {
    lines.push(`# Project Context: ${projectName}`);
    lines.push('');
  }

  if (ctx.model.length > 0) {
    const byCategory: Record<string, ModelEntry[]> = {};
    for (const entry of ctx.model) {
      if (!byCategory[entry.category]) byCategory[entry.category] = [];
      byCategory[entry.category].push(entry);
    }

    for (const [category, entries] of Object.entries(byCategory)) {
      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      for (const entry of entries) {
        lines.push(`- **${entry.key}**: ${entry.value}`);
      }
      lines.push('');
    }
  }

  if (ctx.decisions.length > 0) {
    lines.push('## Decisions');
    for (const d of ctx.decisions) {
      lines.push(`- **${d.decision}** — ${d.rationale}`);
      if (d.alternatives) lines.push(`  Alternatives considered: ${d.alternatives}`);
    }
    lines.push('');
  }

  if (ctx.taskState) {
    lines.push('## Current Task State');
    if (ctx.taskState.in_progress.length > 0) {
      lines.push(`In progress: ${ctx.taskState.in_progress.join(', ')}`);
    }
    if (ctx.taskState.blocked.length > 0) {
      lines.push(`Blocked: ${ctx.taskState.blocked.join(', ')}`);
    }
    if (ctx.taskState.next.length > 0) {
      lines.push(`Next: ${ctx.taskState.next.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
