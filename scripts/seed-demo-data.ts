#!/usr/bin/env npx tsx
/**
 * Seeds demo data for the dashboard.
 * Creates a workspace, 3 projects (hierarchy), model entries, decisions, and task states.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var. Get it from: supabase status');
  process.exit(1);
}

async function main() {
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get the test user
  const { data: users } = await client.auth.admin.listUsers();
  const user = users?.users.find((u: any) => u.email === 'dev@uberclaude.local');
  if (!user) throw new Error('Run local-setup.ts first');

  console.log('Seeding demo data...\n');

  // 1. Create workspace
  const { data: workspace, error: wsErr } = await client
    .from('workspaces')
    .upsert({ name: 'Acme Corp', slug: 'acme-corp', owner_id: user.id }, { onConflict: 'slug' })
    .select()
    .single();
  if (wsErr) throw new Error(`Workspace: ${wsErr.message}`);
  console.log(`Workspace: ${workspace.name} (${workspace.id})`);

  // 2. Root project: Main Product
  const { data: mainProduct, error: mpErr } = await client
    .from('projects')
    .upsert({
      workspace_id: workspace.id,
      name: 'Main Product',
      slug: 'main-product',
      parent_id: null,
      codebase_path: '/home/waseem/projects/main-product',
    }, { onConflict: 'workspace_id,slug' })
    .select()
    .single();
  if (mpErr) throw new Error(`Main Product: ${mpErr.message}`);
  console.log(`Project: ${mainProduct.name} (root)`);

  // Permissions for root: write on everything
  const categories = ['codebase', 'domain', 'decisions', 'conventions', 'task_state'];
  for (const cat of categories) {
    await client.from('project_permissions').upsert(
      { project_id: mainProduct.id, category: cat, level: 'write' },
      { onConflict: 'project_id,category' }
    );
  }

  // 3. Child: Super Admin
  const { data: superAdmin, error: saErr } = await client
    .from('projects')
    .upsert({
      workspace_id: workspace.id,
      name: 'Super Admin',
      slug: 'super-admin',
      parent_id: mainProduct.id,
    }, { onConflict: 'workspace_id,slug' })
    .select()
    .single();
  if (saErr) throw new Error(`Super Admin: ${saErr.message}`);
  console.log(`Project: ${superAdmin.name} (child of Main Product)`);

  for (const cat of categories) {
    await client.from('project_permissions').upsert(
      { project_id: superAdmin.id, category: cat, level: 'write' },
      { onConflict: 'project_id,category' }
    );
  }

  // 4. Child: Marketing
  const { data: marketing, error: mkErr } = await client
    .from('projects')
    .upsert({
      workspace_id: workspace.id,
      name: 'Marketing',
      slug: 'marketing',
      parent_id: mainProduct.id,
    }, { onConflict: 'workspace_id,slug' })
    .select()
    .single();
  if (mkErr) throw new Error(`Marketing: ${mkErr.message}`);
  console.log(`Project: ${marketing.name} (child of Main Product)`);

  const marketingPerms: Record<string, string> = {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  };
  for (const [cat, level] of Object.entries(marketingPerms)) {
    await client.from('project_permissions').upsert(
      { project_id: marketing.id, category: cat, level },
      { onConflict: 'project_id,category' }
    );
  }

  // 5. Model entries for Main Product
  const modelEntries = [
    { project_id: mainProduct.id, category: 'domain', key: 'User', value: 'Has email, name, subscription tier. Can create projects and invite team members.' },
    { project_id: mainProduct.id, category: 'domain', key: 'Workspace', value: 'Top-level grouping. Owned by one user. Contains multiple projects.' },
    { project_id: mainProduct.id, category: 'domain', key: 'Project', value: 'A codebase or initiative. Has parent/child hierarchy with permission inheritance.' },
    { project_id: mainProduct.id, category: 'codebase', key: 'API Layer', value: 'Hono REST API with Supabase Postgres backend. All routes authenticated via JWT.' },
    { project_id: mainProduct.id, category: 'codebase', key: 'Auth', value: 'Supabase Auth with magic link + password. JWT stored in ~/.uberclaude/credentials.json' },
    { project_id: mainProduct.id, category: 'conventions', key: 'Code Style', value: 'TypeScript strict, ESM modules, functional patterns preferred. No classes.' },
    { project_id: mainProduct.id, category: 'conventions', key: 'Testing', value: 'Vitest for all packages. TDD required — tests before implementation.' },
    { project_id: mainProduct.id, category: 'conventions', key: 'Git', value: 'Conventional commits. One commit per logical change. No squash on merge.' },
  ];

  for (const entry of modelEntries) {
    await client.from('project_models').upsert(entry, { onConflict: 'project_id,category,key' });
  }
  console.log(`\nSeeded ${modelEntries.length} model entries for Main Product`);

  // Model entries for Marketing
  const marketingModels = [
    { project_id: marketing.id, category: 'conventions', key: 'Tone', value: 'Professional but approachable. No jargon. Focus on developer pain points.' },
    { project_id: marketing.id, category: 'domain', key: 'Target Audience', value: 'Solo developers and small teams using Claude Code who work across multiple projects.' },
  ];
  for (const entry of marketingModels) {
    await client.from('project_models').upsert(entry, { onConflict: 'project_id,category,key' });
  }
  console.log(`Seeded ${marketingModels.length} model entries for Marketing`);

  // 6. Decisions
  const decisions = [
    { project_id: mainProduct.id, decision: 'Use Supabase for backend', rationale: 'Postgres + auth + RLS + realtime out of the box. Fastest path to MVP.', alternatives: 'Firebase (vendor lock-in), custom Postgres (too much setup)', propagate: true },
    { project_id: mainProduct.id, decision: 'No embeddings for MVP', rationale: 'Dataset per project is small enough to inject all context. Avoids external API dependency and cost.', alternatives: 'OpenAI embeddings (cost), local model (setup complexity)', propagate: true },
    { project_id: mainProduct.id, decision: 'Max 3 levels of project nesting', rationale: 'Covers all real use cases (root → child → grandchild). Keeps queries simple.', alternatives: 'Unlimited nesting (complex queries), 2 levels (too restrictive)', propagate: false },
    { project_id: mainProduct.id, decision: 'Permission inheritance enforced at app + DB level', rationale: 'Defense in depth. App gives clear errors, DB trigger is safety net.', alternatives: 'App only (bypassable), DB only (bad error messages)', propagate: false },
    { project_id: superAdmin.id, decision: 'Share codebase with main product', rationale: 'Super admin builds against the same API. Needs write access to codebase context.', propagate: true },
  ];

  for (const d of decisions) {
    // Check if already exists to avoid duplicates
    const { data: existing } = await client
      .from('decisions')
      .select('id')
      .eq('project_id', d.project_id)
      .eq('decision', d.decision)
      .single();
    if (!existing) {
      await client.from('decisions').insert(d);
    }
  }
  console.log(`Seeded ${decisions.length} decisions`);

  // 7. Task states
  await client.from('task_states').upsert({
    project_id: mainProduct.id,
    in_progress: ['Phase 5: Dashboard polish', 'Integration testing'],
    completed: ['Schema migrations', 'MCP server (8 tools)', 'CLI (8 commands)', 'Hook scripts'],
    blocked: [],
    next: ['Production Supabase setup', 'npm publish MCP server'],
  }, { onConflict: 'project_id' });

  await client.from('task_states').upsert({
    project_id: marketing.id,
    in_progress: ['Landing page copy'],
    completed: [],
    blocked: ['Waiting for final feature list'],
    next: ['Product screenshots', 'Launch blog post'],
  }, { onConflict: 'project_id' });

  console.log(`Seeded task states\n`);
  console.log('✅ Demo data ready! Refresh the dashboard to see it.');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
