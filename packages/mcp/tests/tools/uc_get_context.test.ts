// packages/mcp/tests/tools/uc_get_context.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { getContext } from '../../src/tools/uc_get_context';

const client = getTestClient();
let workspaceId: string;
let rootId: string;
let childId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  rootId = await seedTestProject(client, workspaceId, { name: 'Root', slug: 'gc-root' });
  await seedPermissions(client, rootId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
  await client.from('project_models').insert([
    { project_id: rootId, category: 'domain', key: 'Feature', value: 'User authentication' },
  ]);

  childId = await seedTestProject(client, workspaceId, { name: 'Child', slug: 'gc-child', parentId: rootId });
  await seedPermissions(client, childId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('getContext', () => {
  it('returns formatted text context', async () => {
    const result = await getContext(client, rootId);
    expect(result).toContain('Feature');
    expect(result).toContain('User authentication');
  });

  it('includes parent context for child', async () => {
    const result = await getContext(client, childId);
    expect(result).toContain('Feature');
    expect(result).toContain('User authentication');
  });
});
