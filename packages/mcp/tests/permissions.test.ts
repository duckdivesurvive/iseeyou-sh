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
  it('allows write when project has write permission', async () => {
    await expect(checkWritePermission(client, rootProjectId, 'decisions')).resolves.not.toThrow();
  });

  it('rejects when project only has read permission', async () => {
    await expect(checkWritePermission(client, childProjectId, 'decisions')).rejects.toThrow('read-only');
  });

  it('rejects when project has none permission', async () => {
    const noneProjectId = await seedTestProject(client, workspaceId, { name: 'None', slug: 'none-proj', parentId: rootProjectId });
    await seedPermissions(client, noneProjectId, {
      codebase: 'none', domain: 'none', decisions: 'none', conventions: 'none', task_state: 'write',
    });
    await expect(checkWritePermission(client, noneProjectId, 'decisions')).rejects.toThrow();
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
