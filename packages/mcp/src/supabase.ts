import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function createNewClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'Set these before starting the MCP server.'
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createNewClient();
  }
  return client;
}

/**
 * Reset the cached client. Called when a connection error is detected
 * so the next call creates a fresh connection.
 */
export function resetSupabaseClient(): void {
  client = null;
}
