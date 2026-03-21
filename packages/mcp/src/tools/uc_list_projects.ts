import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export async function listProjects(client: SupabaseClient, workspaceId: string) {
  const { data: projects, error } = await client
    .from('projects')
    .select('id, name, slug, parent_id, codebase_path, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at');

  if (error) throw new Error(`Failed to list projects: ${error.message}`);

  // Fetch permissions for all projects
  const projectIds = (projects || []).map((p: any) => p.id);
  const { data: allPerms } = await client
    .from('project_permissions')
    .select('project_id, category, level')
    .in('project_id', projectIds);

  // Group permissions by project
  const permsByProject: Record<string, Record<string, string>> = {};
  for (const perm of allPerms || []) {
    if (!permsByProject[perm.project_id]) permsByProject[perm.project_id] = {};
    permsByProject[perm.project_id][perm.category] = perm.level;
  }

  return (projects || []).map((p: any) => ({
    ...p,
    permissions: permsByProject[p.id] || {},
  }));
}

export function registerListProjectsTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_list_projects',
    { workspace_id: z.string().uuid() },
    async (args) => {
      const projects = await listProjects(client, args.workspace_id);

      // Format as tree
      const lines: string[] = [];
      const roots = projects.filter((p: any) => !p.parent_id);
      const childrenOf = (parentId: string) => projects.filter((p: any) => p.parent_id === parentId);

      function renderTree(project: any, indent: string = '') {
        const permStr = Object.entries(project.permissions)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        lines.push(`${indent}${project.name} (${project.slug}) [${permStr}]`);
        for (const child of childrenOf(project.id)) {
          renderTree(child, indent + '  ');
        }
      }

      for (const root of roots) renderTree(root);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
