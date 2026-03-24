// packages/mcp/tests/tools/uc_log_decision.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, seedTestWorkspace, seedTestProject, seedPermissions, cleanupTestData } from '../helpers/setup';
import { logDecision } from '../../src/tools/uc_log_decision';

const client = getTestClient();
let workspaceId: string;
let writeProjectId: string;
let readOnlyProjectId: string;

beforeAll(async () => {
  workspaceId = await seedTestWorkspace(client);
  writeProjectId = await seedTestProject(client, workspaceId, { name: 'Writer', slug: 'ld-writer' });
  await seedPermissions(client, writeProjectId, {
    codebase: 'write', domain: 'write', decisions: 'write', conventions: 'write', task_state: 'write',
  });

  readOnlyProjectId = await seedTestProject(client, workspaceId, { name: 'Reader', slug: 'ld-reader', parentId: writeProjectId });
  await seedPermissions(client, readOnlyProjectId, {
    codebase: 'read', domain: 'read', decisions: 'read', conventions: 'read', task_state: 'write',
  });
});

afterAll(async () => {
  await cleanupTestData(client);
});

describe('logDecision', () => {
  it('logs a decision when project has write permission', async () => {
    const result = await logDecision(client, {
      project_id: writeProjectId,
      decision: 'Use Postgres',
      rationale: 'Reliable',
    });
    expect(result.decision).toBe('Use Postgres');
    expect(result.id).toBeDefined();
  });

  it('allows read-only project to log its own decisions', async () => {
    // A project can always write its own decisions, regardless of parent permission level
    const result = await logDecision(client, {
      project_id: readOnlyProjectId,
      decision: 'Own decision',
      rationale: 'Projects can always write their own data',
    });
    expect(result.decision).toBe('Own decision');
  });

  it('supports supersedes_id', async () => {
    const first = await logDecision(client, {
      project_id: writeProjectId,
      decision: 'Old approach',
      rationale: 'Initial',
    });
    const second = await logDecision(client, {
      project_id: writeProjectId,
      decision: 'New approach',
      rationale: 'Better',
      supersedes_id: first.id,
    });
    expect(second.supersedes_id).toBe(first.id);
  });
});
