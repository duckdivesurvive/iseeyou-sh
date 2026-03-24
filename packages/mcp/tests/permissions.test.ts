import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from './helpers/setup';
import { checkWritePermission, getProjectPermissions, getAncestorChain } from '../src/permissions';

const client = getTestClient();
let workspaceId: string;
let rootProjectId: string;
let childProjectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);

  rootProjectId = await seedTestProject(client, workspaceId, { name: 'Root', slug: 'root' });
  await seedPermissions(client, rootProjectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });

  childProjectId = await seedTestProject(client, workspaceId, { name: 'Child', slug: 'child', parentId: rootProjectId });
  await seedPermissions(client, childProjectId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('getProjectPermissions', () => {
  it('returns all permissions for a project', async () => {
    const perms = await getProjectPermissions(client, rootProjectId);
    expect(perms).toHaveProperty('codebase', 'write');
    expect(perms).toHaveProperty('domain', 'write');
    expect(perms).toHaveProperty('task_state', 'write');
  });
});

describe('checkWritePermission', () => {
  it('always allows writing to own project regardless of permission level', async () => {
    // Child has read-only on decisions, but writing to OWN project is always allowed
    await expect(checkWritePermission(client, childProjectId, 'decisions')).resolves.not.toThrow();
  });

  it('allows writing to own project even with none permission', async () => {
    const noneProjectId = await seedTestProject(client, workspaceId, { name: 'None', slug: 'none-proj', parentId: rootProjectId });
    await seedPermissions(client, noneProjectId, {
      codebase: 'none', domain: 'none', decisions: 'none', conventions: 'none', task_state: 'write',
    });
    await expect(checkWritePermission(client, noneProjectId, 'decisions')).resolves.not.toThrow();
  });

  it('rejects writing to a different project when permission is read-only', async () => {
    // Child trying to write to parent's decisions — should be blocked
    await expect(checkWritePermission(client, childProjectId, 'decisions', rootProjectId)).rejects.toThrow('read-only');
  });

  it('allows writing to a different project when permission is write', async () => {
    await expect(checkWritePermission(client, rootProjectId, 'decisions', childProjectId)).resolves.not.toThrow();
  });
});

describe('getAncestorChain', () => {
  it('returns empty array for root project', async () => {
    const chain = await getAncestorChain(client, rootProjectId);
    expect(chain).toEqual([]);
  });

  it('returns parent for child project', async () => {
    const chain = await getAncestorChain(client, childProjectId);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(rootProjectId);
  });
});
