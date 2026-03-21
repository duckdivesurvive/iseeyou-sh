#!/usr/bin/env npx tsx
/**
 * Local development setup script.
 * Creates a test user, saves CLI credentials, and verifies everything works.
 *
 * Usage: npx tsx scripts/local-setup.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SERVICE_ROLE_KEY || !PUBLISHABLE_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY env vars');
  console.error('Get these from: supabase status');
  process.exit(1);
}

const TEST_EMAIL = 'dev@uberclaude.local';
const TEST_PASSWORD = 'localdev123';

async function main() {
  console.log('🔧 uberclaude local development setup\n');

  // Create admin client
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Create or get test user
  console.log('1. Creating test user...');

  // Try to create user (may already exist)
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  let userId: string;
  if (createError && createError.message.includes('already been registered')) {
    // User exists, find them
    const { data: users } = await admin.auth.admin.listUsers();
    const existing = users?.users.find((u: any) => u.email === TEST_EMAIL);
    if (!existing) throw new Error('User exists but could not be found');
    userId = existing.id;
    console.log(`   User already exists: ${TEST_EMAIL} (${userId})`);
  } else if (createError) {
    throw new Error(`Failed to create user: ${createError.message}`);
  } else {
    userId = newUser.user.id;
    console.log(`   Created user: ${TEST_EMAIL} (${userId})`);
  }

  // Step 2: Sign in to get session tokens
  console.log('2. Signing in...');
  const anonClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) throw new Error(`Sign in failed: ${signInError.message}`);
  if (!session.session) throw new Error('No session returned');

  console.log(`   Signed in successfully`);

  // Step 3: Save credentials for CLI
  console.log('3. Saving CLI credentials...');
  const credDir = join(homedir(), '.uberclaude');
  const credPath = join(credDir, 'credentials.json');

  mkdirSync(credDir, { recursive: true });
  writeFileSync(credPath, JSON.stringify({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    supabase_url: SUPABASE_URL,
    supabase_anon_key: PUBLISHABLE_KEY,
  }, null, 2), { mode: 0o600 });

  console.log(`   Saved to ${credPath}`);

  // Step 4: Verify by querying workspaces
  console.log('4. Verifying database access...');
  const authClient = createClient(SUPABASE_URL, session.session.access_token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: workspaces, error: wsError } = await authClient
    .from('workspaces')
    .select('id, name');

  if (wsError) {
    console.log(`   ⚠ Query returned error: ${wsError.message}`);
    console.log('   This is expected if RLS is blocking (service role works, user JWT needs workspace ownership)');
  } else {
    console.log(`   Found ${workspaces.length} workspace(s)`);
  }

  console.log('\n✅ Local setup complete!\n');
  console.log('Next steps:');
  console.log('  1. cd to any project directory');
  console.log(`  2. Run: cd ${process.cwd()} && npx tsx packages/cli/src/index.ts init`);
  console.log('  3. Follow the prompts to set up your first project');
  console.log('');
  console.log('Or start the dashboard:');
  console.log('  cd app && pnpm dev');
  console.log('');
  console.log('Environment variables for MCP server / hooks:');
  console.log(`  SUPABASE_URL=${SUPABASE_URL}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`);
}

main().catch((err) => {
  console.error(`\n❌ Setup failed: ${err.message}`);
  process.exit(1);
});
