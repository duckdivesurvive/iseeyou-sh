// packages/mcp/src/tools/uc_log_decision.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkWritePermission } from '../permissions.js';

interface LogDecisionInput {
  project_id: string;
  decision: string;
  rationale: string;
  alternatives?: string;
  supersedes_id?: string;
  propagate?: boolean;
  git_ref?: string;
}

export async function logDecision(client: SupabaseClient, input: LogDecisionInput) {
  await checkWritePermission(client, input.project_id, 'decisions');

  const { data, error } = await client
    .from('decisions')
    .insert({
      project_id: input.project_id,
      decision: input.decision,
      rationale: input.rationale,
      alternatives: input.alternatives || null,
      supersedes_id: input.supersedes_id || null,
      propagate: input.propagate || false,
      git_ref: input.git_ref || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log decision: ${error.message}`);
  return data;
}

export function registerLogDecisionTool(server: McpServer, client: SupabaseClient): void {
  server.tool(
    'uc_log_decision',
    {
      project_id: z.string().uuid(),
      decision: z.string().min(1),
      rationale: z.string().min(1),
      alternatives: z.string().optional(),
      supersedes_id: z.string().uuid().optional(),
      propagate: z.boolean().optional(),
      git_ref: z.string().optional(),
    },
    async (args) => {
      const result = await logDecision(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
