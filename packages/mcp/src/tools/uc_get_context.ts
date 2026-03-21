// packages/mcp/src/tools/uc_get_context.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { assembleContext, formatContextAsText } from '../context.js';

export async function getContext(client: SupabaseClient, projectId: string): Promise<string> {
  // Get project name for the header
  const { data: project } = await client
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single();

  const ctx = await assembleContext(client, projectId);
  return formatContextAsText(ctx, project?.name);
}

export function registerGetContextTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_get_context',
    { project_id: z.string().uuid() },
    async (args) => {
      const text = await getContext(client, args.project_id);
      return { content: [{ type: 'text', text }] };
    }
  );
}
