// packages/cli/tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  writeProjectConfig,
  readProjectConfig,
  writeLocalConfig,
  readLocalConfig,
  type ProjectConfig,
  type LocalConfig,
} from '../src/config';

const testDir = join(tmpdir(), `uc-config-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('ProjectConfig (.uberclaude)', () => {
  it('writes and reads project config', () => {
    const config: ProjectConfig = { workspace: 'acme-corp', project: 'main-product' };
    writeProjectConfig(testDir, config);
    const loaded = readProjectConfig(testDir);
    expect(loaded).toEqual(config);
  });

  it('returns null when no config exists', () => {
    expect(readProjectConfig(testDir)).toBeNull();
  });
});

describe('LocalConfig (.uberclaude.local)', () => {
  it('writes and reads local config', () => {
    const config: LocalConfig = {
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
    };
    writeLocalConfig(testDir, config);
    const loaded = readLocalConfig(testDir);
    expect(loaded).toEqual(config);
  });

  it('returns null when no local config exists', () => {
    expect(readLocalConfig(testDir)).toBeNull();
  });
});
