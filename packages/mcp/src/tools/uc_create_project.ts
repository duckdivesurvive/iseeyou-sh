// packages/mcp/src/tools/uc_create_project.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProjectPermissions, type PermissionMap } from '../permissions.js';

const ALL_CATEGORIES = ['codebase', 'domain', 'decisions', 'conventions', 'task_state'] as const;

interface CreateProjectInput {
  workspace_id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  codebase_path?: string | null;
  permissions?: PermissionMap;
}

interface ProjectRecord {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  codebase_path: string | null;
  created_at: string;
}

export async function createProject(
  client: SupabaseClient,
  input: CreateProjectInput
): Promise<ProjectRecord> {
  // Insert the project
  const { data: project, error } = await client
    .from('projects')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      slug: input.slug,
      parent_id: input.parent_id || null,
      codebase_path: input.codebase_path || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);

  // Determine permissions
  let permissions: PermissionMap;
  if (input.permissions) {
    permissions = input.permissions;
  } else if (input.parent_id) {
    // Inherit parent's permissions
    permissions = await getProjectPermissions(client, input.parent_id);
  } else {
    // Root project: write on everything
    permissions = {};
    for (const cat of ALL_CATEGORIES) {
      permissions[cat] = 'write';
    }
  }

  // Insert permission rows (DB trigger validates inheritance)
  const permRows = ALL_CATEGORIES.map((category) => ({
    project_id: project.id,
    category,
    level: permissions[category] || 'none',
  }));

  const { error: permError } = await client
    .from('project_permissions')
    .insert(permRows);

  if (permError) {
    // Rollback: delete the project we just created
    await client.from('projects').delete().eq('id', project.id);
    throw new Error(`Failed to set permissions: ${permError.message}`);
  }

  return project;
}

export function registerCreateProjectTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_create_project',
    {
      workspace_id: z.string().uuid(),
      name: z.string().min(1),
      slug: z.string().min(1),
      parent_id: z.string().uuid().optional(),
      codebase_path: z.string().optional(),
      permissions: z.record(z.enum(['none', 'read', 'write'])).optional(),
    },
    async (args) => {
      const project = await createProject(client, {
        workspace_id: args.workspace_id,
        name: args.name,
        slug: args.slug,
        parent_id: args.parent_id,
        codebase_path: args.codebase_path,
        permissions: args.permissions as PermissionMap | undefined,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
      };
    }
  );
}
