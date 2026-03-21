import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export async function getProjectModel(client: SupabaseClient, projectId: string) {
  const { data, error } = await client
    .from('project_models')
    .select('category, key, value')
    .eq('project_id', projectId)
    .order('category')
    .order('key');

  if (error) throw new Error(`Failed to get project model: ${error.message}`);
  return data || [];
}

export function registerGetProjectModelTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_get_project_model',
    { project_id: z.string().uuid() },
    async (args) => {
      const entries = await getProjectModel(client, args.project_id);
      return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
    }
  );
}
