// packages/mcp/tests/tools/uc_create_project.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedPermissions, cleanupTestData } from '../helpers/setup';
import { createProject } from '../../src/tools/uc_create_project';

const client = getTestClient();
let workspaceId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('createProject', () => {
  it('creates a root project with write permissions on everything', async () => {
    const result = await createProject(client, {
      workspace_id: workspaceId,
      name: 'Main Product',
      slug: 'main-product',
    });

    expect(result.name).toBe('Main Product');
    expect(result.id).toBeDefined();

    // Check permissions were auto-created
    const { data: perms } = await client
      .from('project_permissions')
      .select('category, level')
      .eq('project_id', result.id);

    expect(perms).toHaveLength(5);
    for (const perm of perms!) {
      expect(perm.level).toBe('write');
    }
  });

  it('creates a child project with specified permissions', async () => {
    // First create a root
    const root = await createProject(client, {
      workspace_id: workspaceId,
      name: 'Root',
      slug: 'cp-root',
    });

    const child = await createProject(client, {
      workspace_id: workspaceId,
      name: 'Marketing',
      slug: 'cp-marketing',
      parent_id: root.id,
      permissions: {
        codebase: 'read',
        domain: 'read',
        decisions: 'read',
        conventions: 'read',
        task_state: 'write',
      },
    });

    expect(child.parent_id).toBe(root.id);

    const { data: perms } = await client
      .from('project_permissions')
      .select('category, level')
      .eq('project_id', child.id);

    const permMap: Record<string, string> = {};
    for (const p of perms!) permMap[p.category] = p.level;
    expect(permMap.codebase).toBe('read');
    expect(permMap.task_state).toBe('write');
  });

  it('rejects child permissions that exceed parent', async () => {
    const root = await createProject(client, {
      workspace_id: workspaceId,
      name: 'Root2',
      slug: 'cp-root2',
    });

    // Set root to read on codebase
    await client
      .from('project_permissions')
      .update({ level: 'read' })
      .eq('project_id', root.id)
      .eq('category', 'codebase');

    await expect(
      createProject(client, {
        workspace_id: workspaceId,
        name: 'Bad Child',
        slug: 'cp-bad-child',
        parent_id: root.id,
        permissions: { codebase: 'write', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write' },
      })
    ).rejects.toThrow();
  });
});
