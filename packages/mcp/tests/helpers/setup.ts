import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: SupabaseClient;

export function getTestClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}

let testUserId: string | null = null;

async function getOrCreateTestUser(client: SupabaseClient): Promise<string> {
  if (testUserId) return testUserId;
  const { data, error } = await client.auth.admin.createUser({
    email: `test-${Date.now()}@test.local`,
    password: 'password123',
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  testUserId = data.user.id;
  return testUserId;
}

export async function seedTestWorkspace(client: SupabaseClient): Promise<string> {
  const ownerId = await getOrCreateTestUser(client);
  const { data, error } = await client
    .from('workspaces')
    .insert({ name: 'Test Workspace', slug: `test-${Date.now()}`, owner_id: ownerId })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to seed workspace: ${error.message}`);
  return data.id;
}

export async function seedTestProject(
  client: SupabaseClient,
  workspaceId: string,
  opts: { name?: string; slug?: string; parentId?: string | null } = {}
): Promise<string> {
  const { data, error } = await client
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: opts.name || 'Test Project',
      slug: opts.slug || `proj-${Date.now()}`,
      parent_id: opts.parentId || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to seed project: ${error.message}`);
  return data.id;
}

export async function seedPermissions(
  client: SupabaseClient,
  projectId: string,
  permissions: Record<string, string>
): Promise<void> {
  const rows = Object.entries(permissions).map(([category, level]) => ({
    project_id: projectId,
    category,
    level,
  }));
  const { error } = await client.from('project_permissions').insert(rows);
  if (error) throw new Error(`Failed to seed permissions: ${error.message}`);
}

export async function cleanupTestData(client: SupabaseClient): Promise<void> {
  await client.from('task_states').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('decisions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('project_models').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('project_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('workspaces').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (testUserId) {
    await client.auth.admin.deleteUser(testUserId);
    testUserId = null;
  }
}
