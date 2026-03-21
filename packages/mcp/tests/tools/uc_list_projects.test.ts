import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { listProjects } from '../../src/tools/uc_list_projects';

const client = getTestClient();
let workspaceId: string;
let rootId: string;
let childId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  rootId = await seedTestProject(client, workspaceId, { name: 'Root', slug: 'lp-root' });
  await seedPermissions(client, rootId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });
  childId = await seedTestProject(client, workspaceId, { name: 'Child', slug: 'lp-child', parentId: rootId });
  await seedPermissions(client, childId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('listProjects', () => {
  it('returns all projects in the workspace', async () => {
    const projects = await listProjects(client, workspaceId);
    expect(projects).toHaveLength(2);
    expect(projects).toContainEqual(expect.objectContaining({ name: 'Root' }));
    expect(projects).toContainEqual(expect.objectContaining({ name: 'Child' }));
  });

  it('includes permissions for each project', async () => {
    const projects = await listProjects(client, workspaceId);
    const root = projects.find((p: any) => p.name === 'Root');
    expect(root.permissions).toBeDefined();
    expect(root.permissions.codebase).toBe('write');
  });
});
