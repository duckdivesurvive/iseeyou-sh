// packages/hooks/tests/shared.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readLocalConfig } from '../src/shared';

const testDir = join(tmpdir(), `uc-hooks-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('readLocalConfig', () => {
  it('returns null when no config exists', () => {
    expect(readLocalConfig(testDir)).toBeNull();
  });

  it('reads .uberclaude.local', () => {
    writeFileSync(
      join(testDir, '.uberclaude.local'),
      JSON.stringify({ project_id: 'abc', workspace_id: 'def' })
    );
    const config = readLocalConfig(testDir);
    expect(config).toEqual({ project_id: 'abc', workspace_id: 'def' });
  });
});
