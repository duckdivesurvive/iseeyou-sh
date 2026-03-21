// packages/hooks/src/shared.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LocalConfig {
  project_id: string;
  workspace_id: string;
}

export function readLocalConfig(dir: string): LocalConfig | null {
  try {
    const content = readFileSync(join(dir, '.uberclaude.local'), 'utf-8');
    return JSON.parse(content) as LocalConfig;
  } catch {
    return null;
  }
}

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
