// packages/mcp/src/tools/uc_update_state.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkWritePermission } from '../permissions.js';

interface UpdateStateInput {
  project_id: string;
  in_progress?: string[];
  completed?: string[];
  blocked?: string[];
  next?: string[];
}

export async function updateState(client: SupabaseClient, input: UpdateStateInput) {
  await checkWritePermission(client, input.project_id, 'task_state');

  const { data, error } = await client
    .from('task_states')
    .upsert(
      {
        project_id: input.project_id,
        in_progress: input.in_progress || [],
        completed: input.completed || [],
        blocked: input.blocked || [],
        next: input.next || [],
      },
      { onConflict: 'project_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to update state: ${error.message}`);
  return data;
}

export function registerUpdateStateTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_update_state',
    {
      project_id: z.string().uuid(),
      in_progress: z.array(z.string()).optional(),
      completed: z.array(z.string()).optional(),
      blocked: z.array(z.string()).optional(),
      next: z.array(z.string()).optional(),
    },
    async (args) => {
      const result = await updateState(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
