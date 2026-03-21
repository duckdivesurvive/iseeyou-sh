import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const LEVEL_ORDER: Record<string, number> = { none: 0, read: 1, write: 2 };

interface SetPermissionsResult {
  updated: { category: string; level: string }[];
  affectedChildren: { projectId: string; projectName: string; downgradedCategories: string[] }[];
}

export async function setPermissions(
  client: SupabaseClient,
  projectId: string,
  permissions: Record<string, string>
): Promise<SetPermissionsResult> {
  const updated: { category: string; level: string }[] = [];
  const affectedChildren: SetPermissionsResult['affectedChildren'] = [];

  for (const [category, newLevel] of Object.entries(permissions)) {
    // Update the permission (DB trigger validates inheritance against parent)
    const { error } = await client
      .from('project_permissions')
      .update({ level: newLevel })
      .eq('project_id', projectId)
      .eq('category', category);

    if (error) throw new Error(`Failed to set ${category} to ${newLevel}: ${error.message}`);
    updated.push({ category, level: newLevel });

    // Cascade downgrade to all descendants recursively
    await cascadeDowngrade(client, projectId, category, newLevel, affectedChildren);
  }

  return { updated, affectedChildren };
}

async function cascadeDowngrade(
  client: SupabaseClient,
  parentId: string,
  category: string,
  maxLevel: string,
  affectedChildren: SetPermissionsResult['affectedChildren']
): Promise<void> {
  const { data: children } = await client
    .from('projects')
    .select('id, name')
    .eq('parent_id', parentId);

  if (!children || children.length === 0) return;

  for (const child of children) {
    const { data: childPerm } = await client
      .from('project_permissions')
      .select('level')
      .eq('project_id', child.id)
      .eq('category', category)
      .single();

    if (childPerm && LEVEL_ORDER[childPerm.level] > LEVEL_ORDER[maxLevel]) {
      await client
        .from('project_permissions')
        .update({ level: maxLevel })
        .eq('project_id', child.id)
        .eq('category', category);

      let existing = affectedChildren.find((c) => c.projectId === child.id);
      if (!existing) {
        existing = { projectId: child.id, projectName: child.name, downgradedCategories: [] };
        affectedChildren.push(existing);
      }
      existing.downgradedCategories.push(category);

      // Recurse to this child's children
      await cascadeDowngrade(client, child.id, category, maxLevel, affectedChildren);
    }
  }
}

export function registerSetPermissionsTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_set_permissions',
    {
      project_id: z.string().uuid(),
      permissions: z.record(z.enum(['none', 'read', 'write'])),
    },
    async (args) => {
      const result = await setPermissions(client, args.project_id, args.permissions);

      let text = `Updated permissions:\n${result.updated.map((u) => `  ${u.category}: ${u.level}`).join('\n')}`;

      if (result.affectedChildren.length > 0) {
        text += '\n\nAffected children (auto-downgraded):';
        for (const child of result.affectedChildren) {
          text += `\n  ${child.projectName}: ${child.downgradedCategories.join(', ')}`;
        }
      }

      return { content: [{ type: 'text', text }] };
    }
  );
}
