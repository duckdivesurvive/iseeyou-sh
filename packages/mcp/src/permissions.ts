import type { SupabaseClient } from '@supabase/supabase-js';

type PermissionLevel = 'none' | 'read' | 'write';
type ContextCategory = 'codebase' | 'domain' | 'decisions' | 'conventions' | 'task_state';

export type PermissionMap = Partial<Record<ContextCategory, PermissionLevel>>;

export async function getProjectPermissions(
  client: SupabaseClient,
  projectId: string
): Promise<PermissionMap> {
  const { data, error } = await client
    .from('project_permissions')
    .select('category, level')
    .eq('project_id', projectId);

  if (error) throw new Error(`Failed to get permissions: ${error.message}`);

  const map: PermissionMap = {};
  for (const row of data || []) {
    map[row.category as ContextCategory] = row.level as PermissionLevel;
  }
  return map;
}

export async function checkWritePermission(
  client: SupabaseClient,
  projectId: string,
  category: ContextCategory
): Promise<void> {
  const perms = await getProjectPermissions(client, projectId);
  const level = perms[category] || 'none';

  if (level !== 'write') {
    throw new Error(
      `Permission denied: project has read-only or no access to "${category}". ` +
      `Current level: "${level}". Write permission required.`
    );
  }
}

export async function getAncestorChain(
  client: SupabaseClient,
  projectId: string
): Promise<string[]> {
  const ancestors: string[] = [];

  const { data: project, error } = await client
    .from('projects')
    .select('parent_id')
    .eq('id', projectId)
    .single();

  if (error) throw new Error(`Failed to get project: ${error.message}`);

  let currentParentId = project.parent_id;

  while (currentParentId) {
    ancestors.push(currentParentId);
    if (ancestors.length >= 2) break;

    const { data: parent, error: parentError } = await client
      .from('projects')
      .select('parent_id')
      .eq('id', currentParentId)
      .single();

    if (parentError) break;
    currentParentId = parent.parent_id;
  }

  return ancestors;
}
