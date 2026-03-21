import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from './helpers/setup';
import { assembleContext } from '../src/context';

const client = getTestClient();
let workspaceId: string;
let rootProjectId: string;
let childProjectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);

  rootProjectId = await seedTestProject(client, workspaceId, { name: 'Root', slug: 'ctx-root' });
  await seedPermissions(client, rootProjectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });

  await client.from('project_models').insert([
    { project_id: rootProjectId, category: 'domain', key: 'User', value: 'Has email, name, role' },
    { project_id: rootProjectId, category: 'codebase', key: 'AuthController', value: 'Handles login/logout' },
  ]);

  await client.from('decisions').insert({
    project_id: rootProjectId, decision: 'Use JWT for auth', rationale: 'Stateless', propagate: false,
  });

  await client.from('task_states').insert({
    project_id: rootProjectId, in_progress: ['build auth'], completed: [], blocked: [], next: ['add tests'],
  });

  childProjectId = await seedTestProject(client, workspaceId, { name: 'Child', slug: 'ctx-child', parentId: rootProjectId });
  await seedPermissions(client, childProjectId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });

  await client.from('project_models').insert({
    project_id: childProjectId, category: 'conventions', key: 'Tone', value: 'Professional',
  });

  await client.from('task_states').insert({
    project_id: childProjectId, in_progress: ['design landing page'], completed: [], blocked: [], next: [],
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('assembleContext', () => {
  it('returns own model entries for root project', async () => {
    const ctx = await assembleContext(client, rootProjectId);
    expect(ctx.model).toContainEqual(expect.objectContaining({ key: 'User', category: 'domain' }));
    expect(ctx.model).toContainEqual(expect.objectContaining({ key: 'AuthController', category: 'codebase' }));
  });

  it('returns own decisions for root project', async () => {
    const ctx = await assembleContext(client, rootProjectId);
    expect(ctx.decisions).toContainEqual(expect.objectContaining({ decision: 'Use JWT for auth' }));
  });

  it('returns own task state for root project', async () => {
    const ctx = await assembleContext(client, rootProjectId);
    expect(ctx.taskState?.in_progress).toContain('build auth');
  });

  it('returns parent model entries for child project (read permission)', async () => {
    const ctx = await assembleContext(client, childProjectId);
    expect(ctx.model).toContainEqual(expect.objectContaining({ key: 'User' }));
    expect(ctx.model).toContainEqual(expect.objectContaining({ key: 'AuthController' }));
    expect(ctx.model).toContainEqual(expect.objectContaining({ key: 'Tone' }));
  });

  it('returns parent decisions for child project (read permission)', async () => {
    const ctx = await assembleContext(client, childProjectId);
    expect(ctx.decisions).toContainEqual(expect.objectContaining({ decision: 'Use JWT for auth' }));
  });

  it('returns only own task state for child project', async () => {
    const ctx = await assembleContext(client, childProjectId);
    expect(ctx.taskState?.in_progress).toContain('design landing page');
    expect(ctx.taskState?.in_progress).not.toContain('build auth');
  });

  it('excludes superseded decisions', async () => {
    const { data: oldDecision } = await client.from('decisions').insert({
      project_id: rootProjectId, decision: 'Use sessions', rationale: 'Simple', propagate: false,
    }).select('id').single();

    await client.from('decisions').insert({
      project_id: rootProjectId, decision: 'Switch to JWT', rationale: 'Stateless better',
      supersedes_id: oldDecision!.id, propagate: false,
    });

    const ctx = await assembleContext(client, rootProjectId);
    const decisionTexts = ctx.decisions.map((d: any) => d.decision);
    expect(decisionTexts).not.toContain('Use sessions');
    expect(decisionTexts).toContain('Switch to JWT');
  });
});
