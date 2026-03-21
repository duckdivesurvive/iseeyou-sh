import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { getProjectModel } from '../../src/tools/uc_get_project_model';

const client = getTestClient();
let workspaceId: string;
let projectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  projectId = await seedTestProject(client, workspaceId, { name: 'Model', slug: 'gpm-model' });
  await seedPermissions(client, projectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
  await client.from('project_models').insert([
    { project_id: projectId, category: 'domain', key: 'User', value: 'Has email and name' },
    { project_id: projectId, category: 'codebase', key: 'API', value: 'REST with Hono' },
  ]);
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('getProjectModel', () => {
  it('returns only own model entries (no parent)', async () => {
    const entries = await getProjectModel(client, projectId);
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(expect.objectContaining({ key: 'User' }));
    expect(entries).toContainEqual(expect.objectContaining({ key: 'API' }));
  });
});
