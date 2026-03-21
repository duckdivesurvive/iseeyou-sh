// packages/cli/src/auth.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Credentials {
  access_token: string;
  refresh_token: string;
  supabase_url: string;
  supabase_anon_key?: string;
}

const DEFAULT_CRED_PATH = join(homedir(), '.uberclaude', 'credentials.json');

export function getCredentialsPath(): string {
  return process.env.UC_CREDENTIALS_PATH || DEFAULT_CRED_PATH;
}

export function saveCredentials(path: string, creds: Credentials): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function loadCredentials(path?: string): Credentials | null {
  const credPath = path || getCredentialsPath();
  try {
    const content = readFileSync(credPath, 'utf-8');
    return JSON.parse(content) as Credentials;
  } catch {
    return null;
  }
}

export async function getAuthenticatedClient(creds?: Credentials): Promise<SupabaseClient> {
  const credentials = creds || loadCredentials();
  if (!credentials) {
    throw new Error(
      'Not logged in. Run `uc login` first.'
    );
  }

  const anonKey = credentials.supabase_anon_key || process.env.SUPABASE_ANON_KEY || '';

  // If we have an anon key, create client with it and set session
  if (anonKey) {
    const client = createClient(credentials.supabase_url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await client.auth.setSession({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
    });
    return client;
  }

  // Fallback: use access_token as key (works with service_role-style tokens)
  return createClient(credentials.supabase_url, credentials.access_token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
