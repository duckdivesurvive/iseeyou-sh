// packages/mcp/tests/tools/uc_update_state.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { updateState } from '../../src/tools/uc_update_state';

const client = getTestClient();
let workspaceId: string;
let projectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  projectId = await seedTestProject(client, workspaceId, { name: 'Stateful', slug: 'us-stateful' });
  await seedPermissions(client, projectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('updateState', () => {
  it('creates task state on first call', async () => {
    const result = await updateState(client, {
      project_id: projectId,
      in_progress: ['building auth'],
      next: ['add tests'],
    });
    expect(result.in_progress).toContain('building auth');
    expect(result.next).toContain('add tests');
  });

  it('upserts on subsequent calls', async () => {
    const result = await updateState(client, {
      project_id: projectId,
      in_progress: ['adding tests'],
      completed: ['building auth'],
    });
    expect(result.in_progress).toContain('adding tests');
    expect(result.completed).toContain('building auth');
  });
});
