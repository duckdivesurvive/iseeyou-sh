import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { updateModel } from '../../src/tools/uc_update_model';

const client = getTestClient();
let workspaceId: string;
let writeProjectId: string;
let readOnlyProjectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  writeProjectId = await seedTestProject(client, workspaceId, { name: 'Writer', slug: 'um-writer' });
  await seedPermissions(client, writeProjectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });

  readOnlyProjectId = await seedTestProject(client, workspaceId, { name: 'Reader', slug: 'um-reader', parentId: writeProjectId });
  await seedPermissions(client, readOnlyProjectId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('updateModel', () => {
  it('creates a model entry', async () => {
    const result = await updateModel(client, {
      project_id: writeProjectId,
      category: 'domain',
      key: 'User',
      value: 'Has email and name',
    });
    expect(result.key).toBe('User');
  });

  it('upserts an existing entry', async () => {
    const result = await updateModel(client, {
      project_id: writeProjectId,
      category: 'domain',
      key: 'User',
      value: 'Has email, name, and role',
    });
    expect(result.value).toBe('Has email, name, and role');
  });

  it('rejects when project has read-only on the category', async () => {
    await expect(
      updateModel(client, {
        project_id: readOnlyProjectId,
        category: 'domain',
        key: 'Something',
        value: 'Should fail',
      })
    ).rejects.toThrow('read-only');
  });
});
