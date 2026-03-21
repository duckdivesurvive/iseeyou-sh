import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { setPermissions } from '../../src/tools/uc_set_permissions';

const client = getTestClient();
let workspaceId: string;
let rootId: string;
let childId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  rootId = await seedTestProject(client, workspaceId, { name: 'Root', slug: 'sp-root' });
  await seedPermissions(client, rootId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
  childId = await seedTestProject(client, workspaceId, { name: 'Child', slug: 'sp-child', parentId: rootId });
  await seedPermissions(client, childId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('setPermissions', () => {
  it('updates permissions for a project', async () => {
    const result = await setPermissions(client, childId, { codebase: 'read' });
    expect(result.updated).toContainEqual({ category: 'codebase', level: 'read' });
  });

  it('rejects permissions that exceed parent', async () => {
    // First downgrade parent
    await setPermissions(client, rootId, { domain: 'read' });
    // Then try to set child to write on domain
    await expect(
      setPermissions(client, childId, { domain: 'write' })
    ).rejects.toThrow();
  });

  it('warns about affected children when downgrading', async () => {
    const result = await setPermissions(client, rootId, { conventions: 'read' });
    expect(result.affectedChildren).toBeDefined();
  });
});
