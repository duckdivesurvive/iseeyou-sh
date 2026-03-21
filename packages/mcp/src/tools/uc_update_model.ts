import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkWritePermission } from '../permissions.js';

type ModelCategory = 'codebase' | 'domain' | 'decisions' | 'conventions';

interface UpdateModelInput {
  project_id: string;
  category: ModelCategory;
  key: string;
  value: string;
}

export async function updateModel(client: SupabaseClient, input: UpdateModelInput) {
  await checkWritePermission(client, input.project_id, input.category);

  const { data, error } = await client
    .from('project_models')
    .upsert(
      {
        project_id: input.project_id,
        category: input.category,
        key: input.key,
        value: input.value,
      },
      { onConflict: 'project_id,category,key' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to update model: ${error.message}`);
  return data;
}

export function registerUpdateModelTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_update_model',
    {
      project_id: z.string().uuid(),
      category: z.enum(['codebase', 'domain', 'decisions', 'conventions']),
      key: z.string().min(1),
      value: z.string().min(1),
    },
    async (args) => {
      const result = await updateModel(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
